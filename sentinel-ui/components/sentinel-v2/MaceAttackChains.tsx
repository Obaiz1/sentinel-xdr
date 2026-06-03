"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type Chain, type AlertsResponse, type ChainsResponse, type ChronicleReport, type Alert } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

interface Combined { chains: ChainsResponse; alerts: AlertsResponse }

function asList(v: string[] | string | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : [String(v)]; } catch { return [String(v)]; }
}

function sev(score?: number): { label: string; color: string } {
  const s = score ?? 0;
  if (s >= 75) return { label: "CRITICAL", color: "#ff3366" };
  if (s >= 50) return { label: "HIGH", color: "#ff9900" };
  if (s >= 25) return { label: "MEDIUM", color: "#a855f7" };
  return { label: "LOW", color: "#00ff88" };
}

/** Fallback MITRE technique per kill-chain phase (used if chain has no explicit mapping). */
const PHASE_TECH: Record<string, string> = {
  Reconnaissance: "T1595 Active Scanning",
  "Initial Access": "T1190 Exploit Public-Facing App",
  Execution: "T1059 Command and Scripting Interpreter",
  Persistence: "T1547 Boot/Logon Autostart",
  "Privilege Escalation": "T1068 Exploitation for Priv-Esc",
  "Defense Evasion": "T1070 Indicator Removal",
  "Lateral Movement": "T1021 Remote Services",
  Collection: "T1119 Automated Collection",
  "Command and Control": "T1071 Application Layer Protocol",
  "Command & Control": "T1071 Application Layer Protocol",
  Exfiltration: "T1041 Exfiltration Over C2",
  Impact: "T1499 Endpoint Denial of Service",
  "Endpoint Denial of Service": "T1499 Endpoint Denial of Service",
};

const levelColor: Record<string, string> = { Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88" };

function LogViewer({ alerts }: { alerts: Alert[] }) {
  const [snapshot, setSnapshot] = useState<Alert[] | null>(null); // non-null = paused (frozen)
  const [autoscroll, setAutoscroll] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const paused = snapshot != null;
  const shown = snapshot ?? alerts;
  useEffect(() => { if (autoscroll && !paused) ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [alerts, autoscroll, paused]);
  return (
    <Card tilt={false}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11.5, letterSpacing: "0.14em" }}>RAW TELEMETRY STREAM · LOG VIEWER</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setSnapshot((s) => (s ? null : alerts))} className={`sv-btn ${paused ? "sv-btn-green" : "sv-btn-ghost"}`} style={{ height: 28, minHeight: 28, fontSize: 10 }}>{paused ? "▶ Resume" : "❚❚ Pause"}</button>
            <button type="button" onClick={() => setAutoscroll((a) => !a)} className={`sv-btn ${autoscroll ? "" : "sv-btn-ghost"}`} style={{ height: 28, minHeight: 28, fontSize: 10 }}>{autoscroll ? "⤓ Auto" : "⤓ Manual"}</button>
          </div>
        </div>
        <div ref={ref} style={{ maxHeight: 280, overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, lineHeight: 1.7 }}>
          {shown.length === 0 ? (
            <span style={{ color: "var(--text-muted)" }}>No telemetry. Start Demo Mode or the local sniffer.</span>
          ) : shown.map((a) => {
            const t = (() => { try { return new Date(a.timestamp).toLocaleTimeString(); } catch { return a.timestamp; } })();
            const crit = a.threat_level === "Critical" || a.threat_level === "High";
            return (
              <div key={String(a.id)} style={{ color: crit ? "#ff9bb3" : "var(--text-muted)", padding: "1px 0" }}>
                <span style={{ color: "var(--text-muted)" }}>[{t}]</span>{" "}
                <span style={{ color: crit ? "#ff3366" : "var(--neon-blue)" }}>{crit ? "ALERT" : "LOG"}</span>: {a.attack_vector ?? "event"} {a.src_ip ?? "?"}→{a.dst_ip ?? "?"} {a.protocol ?? ""} <span style={{ color: levelColor[a.threat_level ?? "Low"] }}>[{a.threat_level ?? "Low"}]</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function FeaturedChain({ chain, alerts }: { chain: Chain; alerts: Alert[] }) {
  const phases = asList(chain.kill_chain_phases);
  const techs = asList(chain.mitre_techniques);
  const s = sev(chain.chain_score);
  const [selected, setSelected] = useState<number | null>(phases.length ? phases.length - 1 : null);
  const [report, setReport] = useState<ChronicleReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const relatedIps = useMemo(() => Array.from(new Set(alerts.map((a) => a.src_ip).filter(Boolean) as string[])).slice(0, 4), [alerts]);

  async function genReport() {
    setBusy(true); setErr(null);
    try { setReport(await api.generateChronicle(chain.chain_id)); }
    catch (e) { setErr(e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout") ? "Backend offline." : "Report generation failed."); }
    finally { setBusy(false); }
  }

  const selPhase = selected != null ? phases[selected] : null;
  const selTech = selPhase ? (techs[selected ?? 0] || PHASE_TECH[selPhase] || "—") : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
      {/* Header + node timeline */}
      <Card tilt={false}>
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: s.color, fontSize: 16 }}>⚠</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.08em", color: s.color }}>ACTIVE MACE THREAT CHAIN DETECTED</span>
            <span className="sv-pill" style={{ marginLeft: "auto", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.4)", background: "rgba(0,255,136,0.1)" }}>
              <span className="sv-dot sv-pulse-dot" style={{ background: "var(--neon-green)" }} />LIVE CORRELATION
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>
            INCIDENT_ID: <span style={{ color: "var(--text-primary)" }}>{chain.chain_id}</span>{" // "}SEVERITY: <span style={{ color: s.color }}>{s.label}</span>{" // "}STATUS: <span style={{ color: "var(--neon-orange)" }}>{(chain.status ?? "active").toUpperCase()}</span>{" // "}SCORE: <span style={{ color: s.color }}>{chain.chain_score ?? 0}</span>
          </div>

          {/* Node timeline */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingTop: 18, paddingBottom: 4 }}>
            {phases.length === 0 ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>No kill-chain phases recorded for this chain yet.</span>
            ) : phases.map((p, i) => {
              const active = i === selected;
              const done = selected != null && i < selected;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <button type="button" onClick={() => setSelected(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 104, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 13,
                      border: `1.5px solid ${active ? s.color : done ? "#00ff88" : "rgba(0,212,255,0.3)"}`,
                      background: active ? `${s.color}1f` : done ? "rgba(0,255,136,0.12)" : "rgba(0,212,255,0.05)",
                      color: active ? s.color : done ? "#00ff88" : "var(--neon-blue)",
                      boxShadow: active ? `0 0 14px ${s.color}66` : "none", transition: "all .2s" }}>{i + 1}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: active ? s.color : "var(--text-muted)", textAlign: "center", maxWidth: 96, lineHeight: 1.3 }}>{p}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: done ? "#00ff88" : active ? "var(--neon-orange)" : "var(--text-muted)" }}>{done ? "COMPLETED" : active ? "ACTIVE" : "—"}</span>
                  </button>
                  {i < phases.length - 1 && <div style={{ width: 34, height: 2, marginTop: 18, background: `linear-gradient(90deg, ${i < (selected ?? -1) ? "#00ff88" : s.color}, ${s.color}33)` }} />}
                </div>
              );
            })}
          </div>

          {/* Selected node detail */}
          {selPhase && (
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, border: `1px solid ${s.color}33`, background: `${s.color}0a`, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.7 }}>
              <div style={{ color: s.color, fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: 4 }}>{selPhase.toUpperCase()}</div>
              <div>MITRE: <span style={{ color: "var(--neon-blue)" }}>{selTech}</span></div>
              {relatedIps.length > 0 && <div>Related IPs: <span style={{ color: "var(--text-primary)" }}>{relatedIps.join(", ")}</span></div>}
              {chain.actor_id && <div>Actor: {chain.actor_id}</div>}
              <div>Confidence: <span style={{ color: s.color }}>{chain.ai_confidence != null ? `${Math.round(chain.ai_confidence)}%` : `${chain.chain_score ?? 0}%`}</span></div>
              <div style={{ color: "var(--neon-green)" }}>→ Recommended: contain the {selPhase.toLowerCase()} stage and isolate related IPs.</div>
            </div>
          )}
        </div>
      </Card>

      {/* Log viewer + ARIA insight */}
      <div className="sv-split">
        <LogViewer alerts={alerts} />
        <Card tilt={false}>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="sv-aria-ring" style={{ width: 28, height: 28 }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.14em" }}>ARIA INSIGHT</span>
            </div>
            {chain.attacker_intent && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6, color: "var(--text-primary)" }}>{chain.attacker_intent}</p>}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              Confidence: <span style={{ color: s.color }}>{chain.ai_confidence != null ? `${Math.round(chain.ai_confidence)}%` : `${chain.chain_score ?? 0}%`}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: "rgba(0,212,255,0.08)", overflow: "hidden" }}>
              <div style={{ width: `${chain.ai_confidence ?? chain.chain_score ?? 0}%`, height: "100%", background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-green)" }}>→ Recommended: generate the CHRONICLE narrative, then contain affected hosts and block repeat-offender IPs.</p>
            <button type="button" className="sv-btn" disabled={busy} onClick={genReport} style={{ marginTop: "auto" }}>{busy ? "Generating…" : "📄 Generate ARIA / CHRONICLE Report"}</button>
            {report?.executive_summary && (
              <div style={{ borderTop: "1px solid rgba(168,85,247,0.2)", paddingTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55, color: "var(--text-primary)" }}>
                {report.executive_summary}
                {report.technical_details && <p style={{ color: "var(--text-muted)", marginTop: 6 }}>{report.technical_details}</p>}
              </div>
            )}
            {err && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#ff9bb3" }}>{err}</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function OtherChain({ chain }: { chain: Chain }) {
  const s = sev(chain.chain_score);
  const phases = asList(chain.kill_chain_phases);
  return (
    <Card>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-primary)" }}>{chain.chain_id}</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: s.color }}>{chain.chain_score ?? 0}</span>
        </div>
        {phases.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {phases.map((p, i) => <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 7px", borderRadius: 6, color: s.color, border: `1px solid ${s.color}44`, background: `${s.color}10` }}>{p}</span>)}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function MaceAttackChains() {
  const { data, state, refetch } = usePolling<Combined>(
    async (signal) => {
      const [chains, alerts] = await Promise.all([api.getChains({ signal }), api.getAlerts({ limit: 40 })]);
      return { chains, alerts };
    },
    6000,
    (d) => !d.chains.chains?.length,
  );

  if (state !== "data") {
    return (
      <Card tilt={false}>
        <StateMessage state={state} onRetry={refetch} emptyHint="No active attack chains. MACE correlates multi-stage activity once telemetry flows (try Demo Mode)." />
      </Card>
    );
  }

  const chains = data?.chains.chains ?? [];
  const featured = [...chains].sort((a, b) => (b.chain_score ?? 0) - (a.chain_score ?? 0))[0];
  const others = chains.filter((c) => c.chain_id !== featured.chain_id);
  const alerts = data?.alerts.alerts ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
      <FeaturedChain chain={featured} alerts={alerts} />
      {others.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.14em", margin: "4px 0 10px" }}>OTHER CORRELATED CHAINS ({others.length})</div>
          <div className="sv-grid sv-grid-3">
            {others.map((c) => <OtherChain key={c.chain_id} chain={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}
