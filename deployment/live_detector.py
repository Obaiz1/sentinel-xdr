r"""
live_detector.py — Real-time intrusion detection on LIVE captured traffic.

Turns the Deep Learning model into an actual live detector inside Sentinel XDR:
it sniffs real packets (scapy/Npcap), aggregates them into network flows over a
rolling 2-second window, derives the 8 NSL-KDD-style features the model expects,
and classifies each finished flow through the deployed DL API (/predict). Every
flow is printed as NORMAL / ATTACK with the attack probability.

This is a standalone add-on: it does NOT modify the XDR backend (main.py,
modules/). It talks to the model only over HTTP.

Run (Windows, as Administrator, with Npcap installed):
    .\venv\Scripts\python.exe deployment\live_detector.py
    .\venv\Scripts\python.exe deployment\live_detector.py --api http://127.0.0.1:8001 --iface "Wi-Fi"
    .\venv\Scripts\python.exe deployment\live_detector.py --bpf "ip and not port 22" --log live_flows.jsonl

Linux:
    sudo .venv-dl/bin/python deployment/live_detector.py --iface eth0
"""
from __future__ import annotations

import argparse
import json
import threading
import time
from collections import deque
from dataclasses import dataclass, field

import requests
from scapy.all import IP, TCP, UDP, ICMP, sniff  # type: ignore

DEFAULT_API = "https://obaiz-sentinel-xdr-dl.hf.space"

# Map a destination port -> NSL-KDD service name (best-effort; the model's
# OneHotEncoder ignores unknown services, so anything unmapped still works).
PORT_SERVICE = {
    80: "http", 8080: "http", 443: "http", 21: "ftp", 20: "ftp_data",
    25: "smtp", 23: "telnet", 22: "ssh", 110: "pop_3", 143: "imap4",
    53: "domain", 79: "finger", 70: "gopher", 119: "nntp", 513: "login",
    111: "sunrpc", 6000: "X11", 514: "shell", 515: "printer", 540: "uucp",
}

# ANSI colours for the live feed.
RED, GREEN, YELLOW, DIM, RESET = "\033[91m", "\033[92m", "\033[93m", "\033[2m", "\033[0m"


def service_for(proto: str, dport: int | None) -> str:
    if proto == "icmp":
        return "ecr_i"
    if dport is None:
        return "other"
    if dport == 53:
        return "domain_u" if proto == "udp" else "domain"
    return PORT_SERVICE.get(dport, "private")


@dataclass
class Flow:
    src_ip: str
    dst_ip: str
    dst_port: int | None
    protocol: str          # tcp / udp / icmp
    service: str
    first_ts: float
    last_ts: float
    src_bytes: int = 0
    dst_bytes: int = 0
    packets: int = 0
    finished: bool = False  # saw TCP FIN/RST
    classified: bool = False

    def key(self):
        return (self.src_ip, self.dst_ip, self.dst_port, self.protocol)


class LiveDetector:
    def __init__(self, api: str, threshold: float, idle: float, log_path: str | None):
        self.api = api.rstrip("/")
        self.threshold = threshold
        self.idle = idle              # seconds of inactivity before a flow is finalised
        self.log_path = log_path
        self.flows: dict[tuple, Flow] = {}
        self.recent = deque()         # (ts, dst_ip, service) within the 2s window
        self.lock = threading.Lock()
        self.n_flows = 0
        self.n_attacks = 0
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

        # Canonical flow key: forward direction = (src, dst). Reverse packets of
        # an existing flow add to dst_bytes.
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

    # ── NSL-KDD window features (count / srv_count / same_srv_rate) ──────
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

    # ── classify finalised flows via the DL API ─────────────────────────
    def _classify(self, f: Flow) -> None:
        feats = self._features(f)
        try:
            r = requests.post(f"{self.api}/predict", json={"flows": [feats]}, timeout=15)
            r.raise_for_status()
            pred = r.json()["predictions"][0]
        except Exception as exc:  # noqa: BLE001
            print(f"{YELLOW}[api] {exc}{RESET}")
            return

        prob = pred["attack_probability"]
        is_attack = pred["label"] == 1
        self.n_flows += 1
        if is_attack:
            self.n_attacks += 1
        colour = RED if is_attack else GREEN
        verdict = "ATTACK" if is_attack else "NORMAL"
        port = f.dst_port if f.dst_port is not None else "-"
        t = time.strftime("%H:%M:%S")
        print(
            f"{DIM}{t}{RESET}  {f.src_ip:>15} -> {f.dst_ip:<15}:{str(port):<5} "
            f"{f.service:<9} {f.protocol:<4} "
            f"dur={feats['duration']:<5} sB={feats['src_bytes']:<6} dB={feats['dst_bytes']:<6} "
            f"cnt={feats['count']:<3} "
            f"{colour}{verdict:<6} p={prob:.3f}{RESET}"
        )
        if self.log_path:
            rec = {"ts": time.time(), **feats, "verdict": verdict, "attack_probability": prob}
            with open(self.log_path, "a") as fh:
                fh.write(json.dumps(rec) + "\n")

    # ── reaper: finalise idle / finished flows ──────────────────────────
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

    # ── run ─────────────────────────────────────────────────────────────
    def run(self, iface: str | None, bpf: str | None) -> None:
        # Verify the model API is reachable before sniffing.
        try:
            h = requests.get(f"{self.api}/health", timeout=15).json()
            print(f"{GREEN}DL API ready{RESET}  {self.api}  model={h.get('model_path')}")
        except Exception as exc:  # noqa: BLE001
            print(f"{RED}Cannot reach DL API at {self.api}: {exc}{RESET}")
            print("Start it first (uvicorn / Docker) or pass --api <url>.")
            return

        print(f"{DIM}Capturing live traffic... (Ctrl+C to stop){RESET}")
        print(f"{DIM}iface={iface or 'default'}  filter={bpf or 'ip'}  threshold={self.threshold}{RESET}\n")
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
            print(f"\n{DIM}Stopped. Classified {self.n_flows} flows "
                  f"({self.n_attacks} attack / {self.n_flows - self.n_attacks} normal).{RESET}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Live DL intrusion detector for Sentinel XDR")
    ap.add_argument("--api", default=DEFAULT_API, help="DL API base URL")
    ap.add_argument("--iface", default=None, help="capture interface (default: auto)")
    ap.add_argument("--bpf", default=None, help="BPF capture filter (default: 'ip')")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--idle", type=float, default=2.0,
                    help="seconds of inactivity before a flow is finalised")
    ap.add_argument("--log", default=None, help="append classified flows to this JSONL file")
    args = ap.parse_args()

    LiveDetector(args.api, args.threshold, args.idle, args.log).run(args.iface, args.bpf)


if __name__ == "__main__":
    main()
