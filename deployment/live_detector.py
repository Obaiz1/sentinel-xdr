r"""
live_detector.py — Real-time intrusion detection on LIVE captured traffic.

Turns the Deep Learning model into an actual live detector inside Sentinel XDR:
it sniffs real packets (scapy/Npcap), aggregates them into network flows over a
rolling 2-second window, derives the 8 NSL-KDD-style features the model expects,
classifies each finished flow through the deployed DL API (/predict), and for
every flow prints a verdict (NORMAL / ATTACK) PLUS a recommended response action.

With --serve it also hosts a live web terminal + JSON API + an on-demand report:
    http://127.0.0.1:8050/         live feed (auto-refreshing)
    http://127.0.0.1:8050/api/flows   JSON: recent classifications + summary
    http://127.0.0.1:8050/report      Markdown incident report (what to act on)

Standalone add-on: does NOT modify the XDR backend. Talks to the model over HTTP.

Run (Windows, as Administrator, with Npcap installed):
    .\venv\Scripts\python.exe deployment\live_detector.py --api http://127.0.0.1:8001 --serve
    .\venv\Scripts\python.exe deployment\live_detector.py --serve --bpf "ip and not net 224.0.0.0/4"

Linux:
    sudo .venv-dl/bin/python deployment/live_detector.py --iface eth0 --serve
"""
from __future__ import annotations

import argparse
import json
import threading
import time
from collections import deque
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests
from scapy.all import IP, TCP, UDP, ICMP, sniff  # type: ignore

DEFAULT_API = "https://obaiz-sentinel-xdr-dl.hf.space"

PORT_SERVICE = {
    80: "http", 8080: "http", 443: "http", 21: "ftp", 20: "ftp_data",
    25: "smtp", 23: "telnet", 22: "ssh", 110: "pop_3", 143: "imap4",
    53: "domain", 79: "finger", 70: "gopher", 119: "nntp", 513: "login",
    111: "sunrpc", 6000: "X11", 514: "shell", 515: "printer", 540: "uucp",
}

RED, GREEN, YELLOW, DIM, RESET = "\033[91m", "\033[92m", "\033[93m", "\033[2m", "\033[0m"


def service_for(proto: str, dport: int | None) -> str:
    if proto == "icmp":
        return "ecr_i"
    if dport is None:
        return "other"
    if dport == 53:
        return "domain_u" if proto == "udp" else "domain"
    return PORT_SERVICE.get(dport, "private")


def recommend(feats: dict, prob: float) -> tuple[str, str, str]:
    """Return (severity, category, recommended_action) for a classified flow."""
    if prob < 0.5:
        return ("OK", "Benign", "Allow — normal traffic, no action needed.")

    proto = feats["protocol_type"]
    svc = feats["service"]
    count = feats["count"]
    ssr = feats["same_srv_rate"]
    severity = "HIGH" if prob >= 0.85 else "MEDIUM"

    if proto == "icmp" and count >= 50:
        cat = "ICMP flood (DoS)"
        act = "Block ICMP from the source; enable ICMP rate-limiting at the firewall."
    elif count >= 150 and ssr >= 0.7:
        cat = "DoS / flood"
        act = "Rate-limit or block the source IP; enable SYN cookies; scale mitigation."
    elif count >= 40 and ssr < 0.4:
        cat = "Port scan / probe"
        act = "Block the source IP; alert SOC; watch the host for follow-up exploitation."
    elif svc in ("ftp", "ssh", "telnet", "login", "imap4", "pop_3"):
        cat = "Brute-force / R2L"
        act = "Block the source; enforce MFA; review auth logs for a successful login."
    else:
        cat = "Suspicious flow"
        act = "Isolate/monitor the source IP; capture full PCAP and investigate."
    return (severity, cat, act)


@dataclass
class Flow:
    src_ip: str
    dst_ip: str
    dst_port: int | None
    protocol: str
    service: str
    first_ts: float
    last_ts: float
    src_bytes: int = 0
    dst_bytes: int = 0
    packets: int = 0
    finished: bool = False
    classified: bool = False

    def key(self):
        return (self.src_ip, self.dst_ip, self.dst_port, self.protocol)


class LiveDetector:
    def __init__(self, api: str, threshold: float, idle: float, log_path: str | None):
        self.api = api.rstrip("/")
        self.threshold = threshold
        self.idle = idle
        self.log_path = log_path
        self.flows: dict[tuple, Flow] = {}
        self.recent = deque()
        self.results = deque(maxlen=500)   # classified records for the web UI / report
        self.lock = threading.RLock()      # reentrant: summary() may be called under lock
        self.started = time.time()
        self.n_flows = 0
        self.n_attacks = 0
        self.by_category: dict[str, int] = {}
        self.by_source: dict[str, int] = {}
        self._stop = threading.Event()

    # ── packet ingestion ────────────────────────────────────────────────
    def on_packet(self, pkt) -> None:
        if IP not in pkt:
            return
        ip = pkt[IP]
        now = time.time()
        size = len(pkt)

        if TCP in pkt:
            proto, sport, dport = "tcp", pkt[TCP].sport, pkt[TCP].dport
            flags = str(pkt[TCP].flags)
            fin_rst = ("F" in flags) or ("R" in flags)
        elif UDP in pkt:
            proto, sport, dport, fin_rst = "udp", pkt[UDP].sport, pkt[UDP].dport, False
        elif ICMP in pkt:
            proto, sport, dport, fin_rst = "icmp", None, None, False
        else:
            return

        fwd = (ip.src, ip.dst, dport, proto)
        rev = (ip.dst, ip.src, sport, proto)
        with self.lock:
            if rev in self.flows and fwd not in self.flows:
                f = self.flows[rev]
                f.dst_bytes += size
                f.packets += 1
                f.last_ts = now
                if fin_rst:
                    f.finished = True
                return

            f = self.flows.get(fwd)
            if f is None:
                svc = service_for(proto, dport)
                f = Flow(ip.src, ip.dst, dport, proto, svc, now, now)
                self.flows[fwd] = f
                self.recent.append((now, ip.dst, svc))
            f.src_bytes += size
            f.packets += 1
            f.last_ts = now
            if fin_rst:
                f.finished = True

    def _window_counts(self, dst_ip: str, service: str, ts: float) -> tuple[int, int]:
        cutoff = ts - 2.0
        while self.recent and self.recent[0][0] < cutoff:
            self.recent.popleft()
        count = sum(1 for (_, d, _) in self.recent if d == dst_ip)
        srv_count = sum(1 for (_, _, s) in self.recent if s == service)
        return max(count, 1), max(srv_count, 1)

    def _features(self, f: Flow) -> dict:
        count, srv_count = self._window_counts(f.dst_ip, f.service, f.last_ts)
        same_srv_rate = round(min(srv_count, count) / count, 2)
        return {
            "duration": round(f.last_ts - f.first_ts, 3),
            "protocol_type": f.protocol,
            "service": f.service,
            "src_bytes": f.src_bytes,
            "dst_bytes": f.dst_bytes,
            "count": count,
            "srv_count": srv_count,
            "same_srv_rate": same_srv_rate,
        }

    def _classify(self, f: Flow) -> None:
        feats = self._features(f)
        try:
            r = requests.post(f"{self.api}/predict", json={"flows": [feats]}, timeout=15)
            r.raise_for_status()
            pred = r.json()["predictions"][0]
        except Exception as exc:  # noqa: BLE001
            print(f"{YELLOW}[api] {exc}{RESET}")
            return

        prob = float(pred["attack_probability"])
        is_attack = pred["label"] == 1
        severity, category, action = recommend(feats, prob)

        rec = {
            "ts": time.time(),
            "time": time.strftime("%H:%M:%S"),
            "src_ip": f.src_ip,
            "dst_ip": f.dst_ip,
            "dst_port": f.dst_port,
            "verdict": "ATTACK" if is_attack else "NORMAL",
            "attack_probability": round(prob, 3),
            "severity": severity,
            "category": category,
            "action": action,
            **feats,
        }
        with self.lock:
            self.n_flows += 1
            if is_attack:
                self.n_attacks += 1
                self.by_category[category] = self.by_category.get(category, 0) + 1
                self.by_source[f.src_ip] = self.by_source.get(f.src_ip, 0) + 1
            self.results.appendleft(rec)

        colour = RED if is_attack else GREEN
        port = f.dst_port if f.dst_port is not None else "-"
        extra = f"  [{severity}] {action}" if is_attack else ""
        print(
            f"{DIM}{rec['time']}{RESET}  {f.src_ip:>15} -> {f.dst_ip:<15}:{str(port):<5} "
            f"{f.service:<9} {f.protocol:<4} cnt={feats['count']:<3} "
            f"{colour}{rec['verdict']:<6} p={prob:.3f}{RESET}{RED}{extra}{RESET}"
        )
        if self.log_path:
            with open(self.log_path, "a") as fh:
                fh.write(json.dumps(rec) + "\n")

    def _reaper(self) -> None:
        while not self._stop.is_set():
            time.sleep(0.5)
            now = time.time()
            due: list[Flow] = []
            with self.lock:
                for k, f in list(self.flows.items()):
                    if f.classified:
                        continue
                    if f.finished or (now - f.last_ts) >= self.idle:
                        f.classified = True
                        due.append(f)
                        del self.flows[k]
            for f in due:
                self._classify(f)

    # ── reporting ───────────────────────────────────────────────────────
    def summary(self) -> dict:
        with self.lock:
            return {
                "uptime_sec": round(time.time() - self.started, 1),
                "total": self.n_flows,
                "attacks": self.n_attacks,
                "normal": self.n_flows - self.n_attacks,
                "by_category": dict(sorted(self.by_category.items(), key=lambda x: -x[1])),
                "top_sources": dict(sorted(self.by_source.items(), key=lambda x: -x[1])[:10]),
            }

    def report_markdown(self) -> str:
        s = self.summary()
        lines = [
            "# Sentinel XDR — Live Detection Report",
            "",
            f"- Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"- Model API: {self.api}",
            f"- Uptime: {s['uptime_sec']} s",
            "",
            "## Summary",
            f"- Flows classified: **{s['total']}**",
            f"- Attacks: **{s['attacks']}**   Normal: **{s['normal']}**",
            "",
            "## Attacks by category (what to act on)",
        ]
        if s["by_category"]:
            lines.append("| Category | Count | Recommended action |")
            lines.append("|---|---|---|")
            seen: dict[str, str] = {}
            with self.lock:
                for r in self.results:
                    if r["verdict"] == "ATTACK":
                        seen[r["category"]] = r["action"]
            for cat, n in s["by_category"].items():
                lines.append(f"| {cat} | {n} | {seen.get(cat, '')} |")
        else:
            lines.append("_No attacks detected yet._")

        lines += ["", "## Top attacking sources"]
        if s["top_sources"]:
            lines.append("| Source IP | Attack flows |")
            lines.append("|---|---|")
            for ip, n in s["top_sources"].items():
                lines.append(f"| {ip} | {n} |")
        else:
            lines.append("_None._")

        lines += ["", "## Recent flows (latest 40)", "",
                   "| Time | Source | Dest:Port | Service | Verdict | P(attack) | Action |",
                   "|---|---|---|---|---|---|---|"]
        with self.lock:
            for r in list(self.results)[:40]:
                act = r["action"] if r["verdict"] == "ATTACK" else "—"
                lines.append(
                    f"| {r['time']} | {r['src_ip']} | {r['dst_ip']}:{r['dst_port']} | "
                    f"{r['service']} | {r['verdict']} | {r['attack_probability']} | {act} |"
                )
        return "\n".join(lines) + "\n"

    # ── live web terminal ───────────────────────────────────────────────
    def serve(self, port: int) -> None:
        detector = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):  # silence default logging
                pass

            def _send(self, code, body: bytes, ctype: str):
                self.send_response(code)
                self.send_header("Content-Type", ctype)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if self.path.startswith("/api/flows"):
                    with detector.lock:
                        data = {"summary": detector.summary(),
                                "flows": list(detector.results)[:100]}
                    self._send(200, json.dumps(data).encode(), "application/json")
                elif self.path.startswith("/report"):
                    self._send(200, detector.report_markdown().encode(), "text/plain; charset=utf-8")
                else:
                    self._send(200, LIVE_HTML.encode(), "text/html; charset=utf-8")

        httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        print(f"{GREEN}Live web terminal:{RESET} http://127.0.0.1:{port}   "
              f"(report at /report)")

    # ── run ─────────────────────────────────────────────────────────────
    def run(self, iface: str | None, bpf: str | None, serve_port: int | None,
            report_path: str | None) -> None:
        try:
            h = requests.get(f"{self.api}/health", timeout=15).json()
            print(f"{GREEN}DL API ready{RESET}  {self.api}  model={h.get('model_path')}")
        except Exception as exc:  # noqa: BLE001
            print(f"{RED}Cannot reach DL API at {self.api}: {exc}{RESET}")
            print("Start it first (uvicorn / Docker) or pass --api <url>.")
            return

        if serve_port:
            self.serve(serve_port)

        print(f"{DIM}Capturing live traffic... (Ctrl+C to stop){RESET}")
        print(f"{DIM}iface={iface or 'default'}  filter={bpf or 'ip'}{RESET}\n")
        threading.Thread(target=self._reaper, daemon=True).start()
        try:
            sniff(prn=self.on_packet, store=False, iface=iface,
                  filter=bpf or "ip", stop_filter=lambda _: self._stop.is_set())
        except PermissionError:
            print(f"{RED}Permission denied — run as Administrator (Windows) / sudo (Linux), "
                  f"and ensure Npcap is installed.{RESET}")
        except KeyboardInterrupt:
            pass
        finally:
            self._stop.set()
            s = self.summary()
            print(f"\n{DIM}Stopped. {s['total']} flows "
                  f"({s['attacks']} attack / {s['normal']} normal).{RESET}")
            if report_path:
                with open(report_path, "w", encoding="utf-8") as fh:
                    fh.write(self.report_markdown())
                print(f"Report written -> {report_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Live DL intrusion detector for Sentinel XDR")
    ap.add_argument("--api", default=DEFAULT_API, help="DL API base URL")
    ap.add_argument("--iface", default=None, help="capture interface (default: auto)")
    ap.add_argument("--bpf", default=None, help="BPF capture filter (default: 'ip')")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--idle", type=float, default=2.0,
                    help="seconds of inactivity before a flow is finalised")
    ap.add_argument("--log", default=None, help="append classified flows to this JSONL file")
    ap.add_argument("--serve", nargs="?", const=8050, type=int, default=None,
                    metavar="PORT", help="host a live web terminal (default port 8050)")
    ap.add_argument("--report", default=None, help="write a Markdown report here on exit")
    args = ap.parse_args()

    LiveDetector(args.api, args.threshold, args.idle, args.log).run(
        args.iface, args.bpf, args.serve, args.report)


# Self-contained live web terminal (dark SOC theme; polls /api/flows).
LIVE_HTML = r"""<!doctype html><html><head><meta charset="utf-8">
<title>SENTINEL XDR — Live DL Detector</title>
<style>
 body{background:#070d16;color:#cfe8ff;font-family:Consolas,Menlo,monospace;margin:0;padding:18px}
 h1{color:#00d4ff;font-size:18px;letter-spacing:1px;margin:0 0 4px}
 .sub{color:#5b7a99;font-size:12px;margin-bottom:14px}
 .cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
 .card{background:#0c1626;border:1px solid #14304a;border-radius:8px;padding:10px 16px;min-width:110px}
 .card .k{font-size:11px;color:#5b7a99;text-transform:uppercase}
 .card .v{font-size:22px;font-weight:bold}
 table{width:100%;border-collapse:collapse;font-size:12px}
 th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #122438;white-space:nowrap}
 th{color:#5b7a99;text-transform:uppercase;font-size:10px;position:sticky;top:0;background:#070d16}
 td.act{white-space:normal;color:#ffb27a}
 .ATTACK{color:#ff3b5c;font-weight:bold}.NORMAL{color:#27d17f}
 .HIGH{color:#ff3b5c}.MEDIUM{color:#ffb800}.OK{color:#5b7a99}
 .bar{height:4px;background:#122438;border-radius:3px;overflow:hidden;margin-top:3px}
 .bar>span{display:block;height:100%;background:#ff3b5c}
</style></head><body>
<h1>● SENTINEL XDR — Live Deep Learning Detector</h1>
<div class="sub">Real captured traffic → trained model → verdict + recommended action. Auto-refreshing.</div>
<div class="cards">
 <div class="card"><div class="k">Flows</div><div class="v" id="total">0</div></div>
 <div class="card"><div class="k">Attacks</div><div class="v ATTACK" id="attacks">0</div></div>
 <div class="card"><div class="k">Normal</div><div class="v NORMAL" id="normal">0</div></div>
 <div class="card"><div class="k">Uptime</div><div class="v" id="uptime">0s</div></div>
 <div class="card"><div class="k">Report</div><div class="v"><a href="/report" style="color:#00d4ff;font-size:13px">open ↗</a></div></div>
</div>
<table><thead><tr><th>Time</th><th>Source → Dest:Port</th><th>Service</th><th>Proto</th>
<th>Cnt</th><th>Verdict</th><th>P(attack)</th><th>Sev</th><th>Recommended action</th></tr></thead>
<tbody id="rows"></tbody></table>
<script>
async function tick(){
 try{
  const r=await fetch('/api/flows');const d=await r.json();const s=d.summary;
  total.textContent=s.total;attacks.textContent=s.attacks;normal.textContent=s.normal;
  uptime.textContent=s.uptime_sec+'s';
  rows.innerHTML=d.flows.map(f=>{
   const pct=Math.round(f.attack_probability*100);
   const act=f.verdict==='ATTACK'?f.action:'—';
   return `<tr><td>${f.time}</td><td>${f.src_ip} → ${f.dst_ip}:${f.dst_port}</td>
   <td>${f.service}</td><td>${f.protocol_type}</td><td>${f.count}</td>
   <td class="${f.verdict}">${f.verdict}</td>
   <td>${pct}%<div class="bar"><span style="width:${pct}%"></span></div></td>
   <td class="${f.severity}">${f.severity}</td><td class="act">${act}</td></tr>`;
  }).join('');
 }catch(e){}
 setTimeout(tick,1500);
}
tick();
</script></body></html>"""


if __name__ == "__main__":
    main()
