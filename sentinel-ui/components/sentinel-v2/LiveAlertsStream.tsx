"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type Alert, type AlertsResponse } from "@/lib/apiClient";
import { downloadAlertPdf } from "@/lib/pdfReport";
import { usePolling } from "./usePolling";
import { useNav } from "./NavContext";
import Card from "./Card";
import StateMessage from "./StateMessage";

const LEVELS = ["All", "Critical", "High", "Medium", "Low"] as const;
type Level = (typeof LEVELS)[number];
const levelColor: Record<string, string> = { Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88" };

function nodeId(a: Alert): string {
  return `N-${String(a.id).replace(/\D/g, "").slice(-4).padStart(4, "0")}`;
}
function fmtTime(ts?: string): string { try { return ts ? new Date(ts).toLocaleTimeString() : "—"; } catch { return ts ?? "—"; } }

type LocalStatus = "investigating" | "resolved";

export default function LiveAlertsStream() {
  const nav = useNav();
  const [level, setLevel] = useState<Level>("All");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Alert | null>(null);
  const [tab, setTab] = useState<"insights" | "actions" | "history">("insights");
  const [statuses, setStatuses] = useState<Record<string, LocalStatus>>({});
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (nav.alertFilter && (LEVELS as readonly string[]).includes(nav.alertFilter)) setLevel(nav.alertFilter as Level);
  }, [nav.alertFilter]);

  const { data, state, refetch } = usePolling<AlertsResponse>(() => api.getAlerts({ limit: 100 }), 3000, (d) => !d.alerts?.length);
  const all = useMemo(() => data?.alerts ?? [], [data]);

  const filtered = useMemo(() => {
    let rows = level === "All" ? all : all.filter((a) => a.threat_level === level);
    const term = q.trim().toLowerCase();
    if (term) rows = rows.filter((a) => [a.src_ip, a.dst_ip, a.attack_vector, a.mitre_technique, a.protocol, a.threat_level].some((f) => String(f ?? "").toLowerCase().includes(term)));
    return rows;
  }, [all, level, q]);

  const focus = selected ?? all.find((a) => a.threat_level === "Critical") ?? all.find((a) => a.threat_level === "High") ?? all[0] ?? null;
  const correlated = useMemo(() => (focus ? all.filter((a) => a.src_ip === focus.src_ip && a.id !== focus.id).length : 0), [all, focus]);
  const setStatus = (id: string | number, s: LocalStatus) => setStatuses((m) => ({ ...m, [String(id)]: s }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
      {/* Header */}
      <Card tilt={false}>
        <div style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.1em" }}>LIVE ALERT STREAM</span>
            <span className="sv-pill" style={{ color: "var(--neon-red)", border: "1px solid rgba(255,51,102,0.4)", background: "rgba(255,51,102,0.12)" }}>
              <span className="sv-dot sv-pulse-dot" style={{ background: "var(--neon-red)" }} />REC
            </span>
            <button type="button" className="sv-btn sv-btn-ghost" style={{ marginLeft: "auto", height: 32, minHeight: 32 }} onClick={refetch}>⟳ SYSTEM_SYNC</button>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Monitoring active nodes globally. <span style={{ color: "var(--neon-blue)" }}>{filtered.length}</span> events in the current window.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            {LEVELS.map((l) => (
              <button key={l} type="button" onClick={() => setLevel(l)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer", minHeight: 32,
                  border: `1px solid ${level === l ? (levelColor[l] ?? "rgba(0,212,255,0.5)") : "rgba(74,96,128,0.3)"}`,
                  background: level === l ? `${levelColor[l] ?? "#00d4ff"}1f` : "transparent",
                  color: level === l ? (levelColor[l] ?? "var(--neon-blue)") : "var(--text-muted)" }}>{l.toUpperCase()}</button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search logs, IPs, hashes…"
              style={{ marginLeft: "auto", flex: 1, minWidth: 160, height: 32, padding: "0 12px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 11 }} />
          </div>
        </div>
      </Card>

      {state !== "data" ? (
        <Card tilt={false}><StateMessage state={state} onRetry={refetch} emptyHint="No alerts detected yet. Use Demo Mode in cloud preview, or start the local packet sniffer (Npcap + Admin)." /></Card>
      ) : (
        <div className="sv-split">
          {/* Alert table */}
          <Card tilt={false}>
            <div style={{ padding: "8px 4px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", fontSize: 9.5, letterSpacing: "0.08em" }}>
                    {["TIMESTAMP", "SEV", "VECTOR", "SOURCE IP", "DESTINATION", "NODE ID", "CONF"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.14)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 60).map((a) => {
                    const c = levelColor[a.threat_level ?? "Low"] ?? "#00d4ff";
                    const st = statuses[String(a.id)];
                    return (
                      <tr key={String(a.id)} onClick={() => { setSelected(a); setTab("insights"); }}
                        style={{ cursor: "pointer", borderLeft: focus?.id === a.id ? `2px solid ${c}` : "2px solid transparent", background: focus?.id === a.id ? `${c}0d` : "transparent" }}>
                        <td style={{ padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.06)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtTime(a.timestamp)}</td>
                        <td style={{ padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.06)" }}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c, boxShadow: `0 0 6px ${c}` }} /></td>
                        <td style={{ padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.06)", color: c, whiteSpace: "nowrap" }}>{(a.attack_vector ?? "Anomaly").toUpperCase()}{st && <span style={{ color: st === "resolved" ? "#00ff88" : "#ff9900", marginLeft: 6, fontSize: 8 }}>· {st.toUpperCase()}</span>}</td>
                        <td style={{ padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.06)", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{a.src_ip ?? "?"}</td>
                        <td style={{ padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.06)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{a.dst_ip ?? "?"}{a.dst_port ? `:${a.dst_port}` : ""}</td>
                        <td style={{ padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.06)", color: "var(--neon-blue)", whiteSpace: "nowrap" }}>{nodeId(a)}</td>
                        <td style={{ padding: "8px 8px", borderBottom: "1px solid rgba(0,212,255,0.06)", color: c, whiteSpace: "nowrap" }}>{a.confidence != null ? `${Math.round(a.confidence)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ARIA insight rail */}
          <Card tilt={false}>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span className="sv-aria-ring" style={{ width: 26, height: 26 }} />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.12em", color: "var(--neon-purple)" }}>ARIA_COPILOT</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--neon-green)" }}>NEURAL_LINK · ACTIVE</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["insights", "actions", "history"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)} style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "5px 6px", borderRadius: 7, cursor: "pointer", minHeight: 28,
                    border: `1px solid ${tab === t ? "rgba(0,212,255,0.4)" : "rgba(74,96,128,0.3)"}`, background: tab === t ? "rgba(0,212,255,0.1)" : "transparent", color: tab === t ? "var(--neon-blue)" : "var(--text-muted)" }}>{t.toUpperCase()}</button>
                ))}
              </div>

              {!focus ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>Select an alert to analyze.</span> : tab === "insights" ? (
                <>
                  <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,255,136,0.25)", background: "rgba(0,255,136,0.05)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6 }}>
                    <div style={{ color: "var(--neon-green)", marginBottom: 4 }}>✶ CORRELATION DETECTED</div>
                    The {(focus.attack_vector ?? "alert").toUpperCase()} from {focus.src_ip ?? "?"} shares an origin with <b style={{ color: "var(--text-primary)" }}>{correlated}</b> related alert(s) in the current window.
                    <div style={{ marginTop: 8 }}><span className="cc-badge" style={{ color: "var(--neon-purple)", border: "1px solid rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.12)" }}>⚭ AI CONFIDENCE: {focus.confidence != null ? Math.round(focus.confidence) : 0}%</span></div>
                    <button type="button" className="sv-btn" style={{ marginTop: 10, width: "100%", height: 32, minHeight: 32 }} onClick={() => setNote(`Subnet isolation simulated for ${focus.src_ip} (demo / local-agent mode — no real network change).`)}>[ ISOLATE_SUBNET ]</button>
                  </div>
                  <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,212,255,0.16)", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    ⓘ AUTO-TRIAGE: Node {nodeId(focus)} is under elevated monitoring. WAF rules tightened (advisory).
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", lineHeight: 1.7 }}>
                    &gt; Analyzing payload…<br />&gt; <b style={{ color: "var(--text-primary)" }}>Signature match: {focus.mitre_technique ?? "—"}</b><br />&gt; Generating mitigation policy…
                  </div>
                  {note && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--neon-orange)" }}>{note}</div>}
                </>
              ) : tab === "actions" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button type="button" className="sv-btn" style={{ borderColor: "rgba(168,85,247,0.5)", color: "var(--neon-purple)", background: "rgba(168,85,247,0.12)" }} onClick={() => nav.openAria()}>💬 Ask ARIA</button>
                  <button type="button" className="sv-btn" onClick={() => downloadAlertPdf(focus, nodeId(focus))}>📄 Generate Alert PDF</button>
                  <button type="button" className="sv-btn sv-btn-ghost" onClick={() => setStatus(focus.id, "investigating")}>🔍 Mark Investigating</button>
                  <button type="button" className="sv-btn sv-btn-green" onClick={() => setStatus(focus.id, "resolved")}>✓ Mark Resolved</button>
                  <button type="button" className="sv-btn sv-btn-red" onClick={() => setNote(`Subnet isolation simulated for ${focus.src_ip} (demo / local-agent mode).`)}>⛒ Isolate Subnet</button>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", lineHeight: 1.5 }}>Status changes are tracked in-session. Isolation is simulated unless a Local Authorized Agent is configured.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                  {all.slice(0, 20).map((a) => (
                    <button key={String(a.id)} type="button" onClick={() => setSelected(a)} style={{ textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "5px 4px", borderBottom: "1px solid rgba(0,212,255,0.06)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
                      <span style={{ color: levelColor[a.threat_level ?? "Low"] }}>{fmtTime(a.timestamp)}</span> {a.attack_vector ?? "event"} · {a.src_ip ?? "?"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Console footer */}
      <Card tilt={false}>
        <div style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 10.5, lineHeight: 1.6 }}>
          <div style={{ color: "var(--neon-green)" }}>root@sentinel:~# tail -f /var/log/syslog | grep alert</div>
          {all.slice(0, 5).map((a) => (
            <div key={String(a.id)} style={{ color: (a.threat_level === "Critical" || a.threat_level === "High") ? "#ff9bb3" : "var(--text-muted)" }}>
              {fmtTime(a.timestamp)} {a.protocol ?? "TCP"} {a.src_ip ?? "?"}→{a.dst_ip ?? "?"} {a.attack_vector ?? "event"} [{a.threat_level ?? "Low"}]
            </div>
          ))}
        </div>
      </Card>

      {/* Alert detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="cc-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} />
            <motion.div className="cc-drawer" initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: "tween", duration: 0.25 }}>
              {(() => {
                const a = selected; const c = levelColor[a.threat_level ?? "Low"] ?? "#00d4ff"; const st = statuses[String(a.id)];
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <span className="sv-dot" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.1em", color: c }}>{(a.attack_vector ?? "ALERT").toUpperCase()}</span>
                      <button type="button" onClick={() => setSelected(null)} aria-label="Close" style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 22, width: 32, height: 32 }}>×</button>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.9, color: "var(--text-muted)" }}>
                      <div>Severity: <span style={{ color: c }}>{a.threat_level ?? "—"}</span> {st && <span style={{ color: st === "resolved" ? "#00ff88" : "#ff9900" }}>· {st.toUpperCase()}</span>}</div>
                      <div>Time: {a.timestamp}</div>
                      <div>Source: <span style={{ color: "var(--text-primary)" }}>{a.src_ip ?? "?"}{a.src_port ? `:${a.src_port}` : ""}</span></div>
                      <div>Destination: <span style={{ color: "var(--text-primary)" }}>{a.dst_ip ?? "?"}{a.dst_port ? `:${a.dst_port}` : ""}</span></div>
                      <div>Node ID: <span style={{ color: "var(--neon-blue)" }}>{nodeId(a)}</span></div>
                      <div>Protocol: {a.protocol ?? "—"} {a.tcp_flags ? `· flags ${a.tcp_flags}` : ""}</div>
                      <div>Confidence: <span style={{ color: c }}>{a.confidence != null ? `${Math.round(a.confidence)}%` : "—"}</span></div>
                      {a.mitre_technique && <div>MITRE: <span style={{ color: c }}>{a.mitre_technique}</span></div>}
                    </div>
                    {a.explanation && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, color: "var(--text-primary)", marginTop: 12 }}>{a.explanation}</p>}
                    {a.recommended_action && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, color: "var(--neon-green)", marginTop: 6 }}>→ {a.recommended_action}</p>}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 12, marginBottom: 6 }}>RELATED LOGS</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.6, color: "var(--text-muted)" }}>
                      {all.filter((x) => x.src_ip === a.src_ip).slice(0, 5).map((x) => <div key={String(x.id)}>{fmtTime(x.timestamp)} {x.attack_vector ?? "event"} → {x.dst_ip ?? "?"} [{x.threat_level}]</div>)}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                      <button type="button" className="sv-btn" style={{ flex: 1, minWidth: 120 }} onClick={() => downloadAlertPdf(a, nodeId(a))}>📄 Alert PDF</button>
                      <button type="button" className="sv-btn sv-btn-ghost" style={{ flex: 1, minWidth: 110 }} onClick={() => nav.openAria()}>💬 Ask ARIA</button>
                      <button type="button" className="sv-btn sv-btn-ghost" style={{ flex: 1, minWidth: 110 }} onClick={() => setStatus(a.id, "investigating")}>🔍 Investigating</button>
                      <button type="button" className="sv-btn sv-btn-green" style={{ flex: 1, minWidth: 100 }} onClick={() => setStatus(a.id, "resolved")}>✓ Resolved</button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
