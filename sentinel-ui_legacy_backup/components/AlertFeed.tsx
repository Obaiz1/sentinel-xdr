"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { backendGet } from "@/lib/backend";
import StateMessage from "@/components/StateMessage";

function badge(level: string) {
  const l = (level || "").toLowerCase();
  if (l === "critical") return <span className="badge-critical">{l}</span>;
  if (l === "high") return <span className="badge-high">{l}</span>;
  if (l === "medium") return <span className="badge-medium">{l}</span>;
  return <span className="badge-low">{l || "low"}</span>;
}

function ts(unix: number) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleTimeString();
}

interface Alert {
  id: number;
  timestamp: number;
  src_ip: string;
  dst_ip: string;
  src_port?: number;
  dst_port?: number;
  protocol: string;
  tcp_flags?: string;
  triage_flags?: string;
  threat_level?: string;
  confidence?: number;
  attack_vector?: string;
  mitre_technique?: string;
  explanation?: string;
  recommended_action?: string;
  status: string;
}

export default function AlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const poll = useCallback(async () => {
    try {
      const d = await backendGet<{ alerts: Alert[] }>("/alerts?limit=60");
      setAlerts(d.alerts || []);
      setErrored(false);
    } catch {
      setErrored(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  const levels = ["All", "Critical", "High", "Medium", "Low"];
  const filtered = filter === "All" ? alerts : alerts.filter(a => a.threat_level === filter);

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {levels.map(l => (
          <button
            key={l}
            onClick={() => setFilter(l)}
            style={{
              padding: "4px 14px", borderRadius: 999, cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              border: `1px solid ${filter === l ? "var(--neon-blue)" : "rgba(0,212,255,0.15)"}`,
              background: filter === l ? "rgba(0,212,255,0.12)" : "transparent",
              color: filter === l ? "var(--neon-blue)" : "var(--text-muted)",
              transition: "all 0.2s"
            }}
          >{l}</button>
        ))}
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
          {filtered.length} events
        </span>
      </div>

      {/* Alert rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <AnimatePresence>
          {loading ? (
            <StateMessage variant="loading" message="CONNECTING TO SENTINEL BACKEND…" height={140} />
          ) : errored ? (
            <StateMessage
              variant="offline"
              message="SENTINEL backend unreachable"
              hint="Start the backend (uvicorn) and set NEXT_PUBLIC_API_URL so the dashboard can reach it."
              onRetry={poll}
              height={140}
            />
          ) : filtered.length === 0 ? (
            <StateMessage
              variant="empty"
              message="NO ALERTS DETECTED — SYSTEM MONITORING"
              hint="Open the ⚙ Control Panel and click START DEMO MODE to populate the stream, or start the sniffer for live capture."
              height={140}
            />
          ) : (
            filtered.slice(0, 40).map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
              >
                {/* Main row */}
                <div
                  className="glass-card table-row-hover"
                  style={{ padding: "10px 16px", cursor: "pointer", transition: "all 0.2s" }}
                  onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", minWidth: 65 }}>
                      {ts(alert.timestamp)}
                    </span>
                    {badge(alert.threat_level || "low")}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", flex: "1 1 140px", minWidth: 120 }}>
                      {alert.attack_vector || "Analyzing…"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", flex: 1 }}>
                      {alert.src_ip} → {alert.dst_ip} · {alert.protocol}
                    </span>
                    {alert.confidence != null && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--neon-blue)" }}>
                        {(alert.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                      {expanded === alert.id ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded === alert.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        className="glass-card"
                        style={{
                          margin: "2px 0 4px 0", padding: "16px 20px",
                          borderColor: "rgba(0,212,255,0.25)",
                          background: "rgba(0,20,50,0.6)"
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: "12px 24px", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          <div>
                            <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Network</div>
                            <div style={{ color: "var(--text-primary)" }}>{alert.src_ip}:{alert.src_port ?? "?"} → {alert.dst_ip}:{alert.dst_port ?? "?"}</div>
                            <div style={{ color: "var(--text-muted)", marginTop: 8 }}>Protocol / Flags</div>
                            <div style={{ color: "var(--neon-blue)" }}>{alert.protocol} {alert.tcp_flags || ""}</div>
                          </div>
                          <div>
                            <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>MITRE ATT&CK</div>
                            <div style={{ color: "var(--neon-purple)" }}>{alert.mitre_technique || "—"}</div>
                            <div style={{ color: "var(--text-muted)", marginTop: 8 }}>Action</div>
                            <div style={{ color: "var(--neon-orange)" }}>{alert.recommended_action || "—"}</div>
                          </div>
                        </div>
                        {alert.explanation && (
                          <div style={{
                            marginTop: 12, padding: "10px 14px",
                            background: "rgba(0,212,255,0.05)", borderRadius: 8,
                            border: "1px solid rgba(0,212,255,0.12)",
                            fontSize: 12, lineHeight: 1.6, color: "#94a3b8"
                          }}>
                            {alert.explanation}
                          </div>
                        )}
                        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {(alert.triage_flags || "").split(",").filter(Boolean).map(f => (
                            <span key={f} style={{
                              fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px",
                              borderRadius: 4, border: "1px solid rgba(168,85,247,0.4)",
                              background: "rgba(168,85,247,0.08)", color: "#a855f7"
                            }}>{f.trim()}</span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
