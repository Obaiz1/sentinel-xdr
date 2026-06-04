"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type AlertsResponse, type ChainsResponse } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import { downloadReport } from "@/lib/pdfReport";
import Card from "./Card";
import { IconShield } from "./Icons";

interface Combined { chains: ChainsResponse; alerts: AlertsResponse }

const PROTOCOLS = [
  { key: "subnet" as const, label: "Subnet Isolation" },
  { key: "cred" as const, label: "Credential Rotation" },
  { key: "scrub" as const, label: "Packet Scrubbing" },
];
type ProtoKey = (typeof PROTOCOLS)[number]["key"];

export default function AriaMitigation() {
  const { data } = usePolling<Combined>(
    async (s) => { const [chains, alerts] = await Promise.all([api.getChains({ signal: s }), api.getAlerts({ limit: 30 })]); return { chains, alerts }; },
    8000,
  );
  const chains = useMemo(() => data?.chains.chains ?? [], [data]);
  const alerts = useMemo(() => data?.alerts.alerts ?? [], [data]);
  const topChain = useMemo(() => [...chains].sort((a, b) => (b.chain_score ?? 0) - (a.chain_score ?? 0))[0], [chains]);
  const critical = useMemo(() => alerts.filter((a) => a.threat_level === "Critical" || a.threat_level === "High"), [alerts]);
  const threatIp = topChain?.actor_id || critical[0]?.src_ip || "unknown host";

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [prog, setProg] = useState<Record<ProtoKey, number>>({ subnet: 0, cred: 0, scrub: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tick = useRef(0);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [logs]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function stamp() { const s = tick.current; return `T+00:00:${String(s).padStart(2, "0")}`; }
  function pushLog(line: string) { setLogs((l) => [...l, `${stamp()} > ${line}`].slice(-40)); }

  function start() {
    if (running) return;
    if (timer.current) clearInterval(timer.current);
    setRunning(true); setDone(false); setProg({ subnet: 0, cred: 0, scrub: 0 }); setLogs([]); tick.current = 0;
    const ips = critical.slice(0, 4).map((a) => a.src_ip).filter(Boolean) as string[];
    const steps = [
      `Blocked unauthorized access from ${threatIp}. Signature matches a known exploit.`,
      `Isolating affected subnet for ${ips[0] ?? threatIp}. Terminating rogue sessions.`,
      `Rotating credentials on exposed services. Awaiting checksum validation.`,
      `Scrubbing malicious packets on ingress. Traffic routing normalized.`,
      `Patching vulnerability in auth service for ${ips[1] ?? threatIp}.`,
      `Generating defensive signatures…`,
    ];
    let n = 0;
    timer.current = setInterval(() => {
      tick.current += 1;
      setProg((p) => {
        const np: Record<ProtoKey, number> = {
          subnet: Math.min(100, p.subnet + (Math.random() * 8 + 5)),
          cred: Math.min(100, p.cred + (Math.random() * 6 + 3)),
          scrub: Math.min(100, p.scrub + (Math.random() * 9 + 6)),
        };
        if (np.subnet >= 100 && np.cred >= 100 && np.scrub >= 100 && timer.current) {
          clearInterval(timer.current); timer.current = null; setRunning(false); setDone(true);
          setLogs((l) => [...l, `${stamp()} > Containment complete. Neural firewall stable.`].slice(-40));
        }
        return np;
      });
      if (n < steps.length) { pushLog(steps[n]); n += 1; }
    }, 1100);
  }
  function stop() { if (timer.current) { clearInterval(timer.current); timer.current = null; } setRunning(false); pushLog("Containment paused by operator."); }

  const statusLabel = done ? "CONTAINED" : running ? "CONTAINMENT IN PROGRESS" : "STANDBY";
  const statusColor = done ? "#00ff88" : running ? "#ff9900" : "#4a6080";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
      {/* Header */}
      <Card tilt={false}>
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="sv-aria-ring" style={{ width: 30, height: 30 }}><IconShield style={{ width: 16, height: 16, color: "var(--neon-purple)" }} /></span>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.08em" }}>ARIA AUTONOMOUS MITIGATION</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: critical.length ? "var(--neon-red)" : "var(--text-muted)", marginTop: 2 }}>
              {critical.length ? `● THREAT DETECTED: ${critical.length} critical/high · actor ${threatIp}` : "● No active critical threats"}
            </div>
          </div>
          <span className="sv-pill" style={{ marginLeft: "auto", color: statusColor, border: `1px solid ${statusColor}55`, background: `${statusColor}14` }}>
            <span className="sv-dot sv-pulse-dot" style={{ background: statusColor }} />{statusLabel}
          </span>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--sv-gap)" }}>
        {/* Mitigation protocols */}
        <Card tilt={false}>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11.5, letterSpacing: "0.14em", marginBottom: 14 }}>MITIGATION PROTOCOLS</div>
            {PROTOCOLS.map((p) => {
              const v = Math.round(prog[p.key]);
              const c = v >= 100 ? "#00ff88" : "#00d4ff";
              return (
                <div key={p.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
                    <span style={{ color: "var(--text-primary)" }}>{p.label}</span><span style={{ color: c }}>{v}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: "rgba(0,212,255,0.08)", overflow: "hidden" }}>
                    <div style={{ width: `${v}%`, height: "100%", background: c, boxShadow: `0 0 10px ${c}`, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {!running ? (
                <button type="button" className="sv-btn sv-btn-green" style={{ flex: 1 }} onClick={start}>▶ {done ? "Re-run Containment" : "Initiate Containment"}</button>
              ) : (
                <button type="button" className="sv-btn sv-btn-red" style={{ flex: 1 }} onClick={stop}>■ Pause</button>
              )}
            </div>
          </div>
        </Card>

        {/* Neural firewall radar */}
        <Card tilt={false}>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 260, aspectRatio: "1 / 1" }}>
              <svg viewBox="0 0 200 200" width="100%" height="100%">
                {[30, 55, 80].map((r) => <circle key={r} cx={100} cy={100} r={r} fill="none" stroke={running ? "rgba(0,212,255,0.2)" : "rgba(0,212,255,0.1)"} />)}
                {running && <g className="sv-radar" style={{ transformOrigin: "100px 100px" }}><line x1={100} y1={100} x2={100} y2={20} stroke="rgba(0,212,255,0.6)" strokeWidth={1.5} /></g>}
                <circle cx={100} cy={100} r={done ? 16 : 14} fill="none" stroke={done ? "#00ff88" : "#00d4ff"} strokeWidth={1.5}>
                  <animate attributeName="r" values="14;22;14" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite" />
                </circle>
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <IconShield style={{ width: 40, height: 40, color: done ? "#00ff88" : "#00d4ff", filter: `drop-shadow(0 0 12px ${done ? "#00ff88" : "#00d4ff"}88)` }} />
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", color: done ? "var(--neon-green)" : running ? "var(--neon-blue)" : "var(--text-muted)", marginTop: 10, textAlign: "center" }}>
              {done ? "NEURAL FIREWALL STABLE" : running ? "NEURAL FIREWALL ERECTING…" : "AWAITING AUTHORIZATION"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-muted)", marginTop: 6, textAlign: "center", lineHeight: 1.5 }}>
              Simulation only — no real network change is performed unless a Local Authorized Agent is configured.
            </div>
            <button type="button" className="sv-btn" style={{ marginTop: 12 }} onClick={() => downloadReport("full")}>📄 Mitigation Report</button>
          </div>
        </Card>

        {/* ARIA neural link stream */}
        <Card tilt={false}>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <span className="sv-dot sv-pulse-dot" style={{ background: "var(--neon-purple)", boxShadow: "0 0 8px var(--neon-purple)" }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.12em", color: "var(--neon-purple)" }}>ARIA NEURAL LINK</span>
            </div>
            <div ref={logRef} style={{ maxHeight: 280, overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.7 }}>
              {logs.length === 0 ? (
                <span style={{ color: "var(--text-muted)" }}>Standing by. Initiate containment to stream mitigation events.</span>
              ) : logs.map((l, i) => (
                <div key={i} style={{ color: i === logs.length - 1 ? "var(--neon-green)" : "var(--text-muted)", padding: "1px 0", animation: "sv-rise 0.3s ease both" }}>{l}</div>
              ))}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: running ? "var(--neon-green)" : "var(--text-muted)", marginTop: 10, textAlign: "right" }}>AI OVERWATCH {running ? "ACTIVE" : "IDLE"}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
