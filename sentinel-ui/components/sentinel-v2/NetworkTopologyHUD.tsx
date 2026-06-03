"use client";

import { useMemo } from "react";
import { api, type Statistics, type AlertsResponse, type SystemStatus } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

/**
 * NetworkTopologyHUD — asset map + live telemetry (screenshots 01/07/15/16).
 * Nodes/edges are DERIVED from existing telemetry: /statistics.top_sources +
 * /alerts (src/dst IPs). No dedicated topology API is invented.
 */

interface Combined {
  stats: Statistics;
  alerts: AlertsResponse;
  status: SystemStatus;
}

interface Node {
  ip: string;
  hits: number;
  compromised: boolean;
}

export default function NetworkTopologyHUD() {
  const { data, state, refetch } = usePolling<Combined>(
    async (signal) => {
      const [stats, alerts, status] = await Promise.all([
        api.getStatistics({ signal }),
        api.getAlerts({ limit: 50 }),
        api.getStatus({ signal }),
      ]);
      return { stats, alerts, status };
    },
    5000,
    (d) => !(d.stats.top_sources?.length || d.alerts.alerts?.length),
  );

  const model = useMemo(() => {
    if (!data) return null;
    const alerts = data.alerts.alerts ?? [];
    const critical = new Set(alerts.filter((a) => a.threat_level === "Critical" || a.threat_level === "High").map((a) => a.src_ip).filter(Boolean) as string[]);
    const counts = new Map<string, number>();
    (data.stats.top_sources ?? []).forEach((s) => counts.set(s.src_ip, s.count));
    alerts.forEach((a) => { if (a.src_ip) counts.set(a.src_ip, (counts.get(a.src_ip) ?? 0) + 1); });
    const nodes: Node[] = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ip, hits]) => ({ ip, hits, compromised: critical.has(ip) }));
    const telemetry = {
      activeThreats: alerts.filter((a) => a.threat_level === "Critical" || a.threat_level === "High").length,
      nodes: counts.size,
      compromised: critical.size,
      packetQueue: data.status.queues?.packet_queue_size ?? 0,
    };
    const log = alerts.slice(0, 8).map((a) => {
      const time = (() => { try { return new Date(a.timestamp).toLocaleTimeString(); } catch { return a.timestamp; } })();
      return { time, text: `${a.src_ip ?? "?"} → ${a.dst_ip ?? "?"} ${a.protocol ?? ""} · ${a.attack_vector ?? "anomaly"}`, level: a.threat_level ?? "Low" };
    });
    return { nodes, telemetry, log };
  }, [data]);

  if (state !== "data" || !model) {
    return (
      <Card tilt={false}>
        <StateMessage state={state} onRetry={refetch} emptyHint="No network telemetry yet. Start Demo Mode or the sniffer to map active nodes." />
      </Card>
    );
  }

  const levelColor: Record<string, string> = { Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88" };
  const N = model.nodes.length;

  return (
    <div className="sv-split">
      {/* Topology radar + nodes */}
      <Card delay={0}>
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.16em", marginBottom: 12 }}>ASSET MAP · LIVE TOPOLOGY</div>
          <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxWidth: 360, margin: "0 auto" }}>
            <svg viewBox="0 0 200 200" width="100%" height="100%">
              {/* radar rings */}
              {[30, 55, 80].map((r) => <circle key={r} cx={100} cy={100} r={r} fill="none" stroke="rgba(0,212,255,0.12)" />)}
              {/* radar sweep */}
              <g className="sv-radar" style={{ transformOrigin: "100px 100px" }}>
                <line x1={100} y1={100} x2={100} y2={20} stroke="rgba(0,212,255,0.5)" strokeWidth={1.5} />
              </g>
              {/* edges + nodes */}
              {model.nodes.map((node, i) => {
                const ang = (i / Math.max(1, N)) * Math.PI * 2 - Math.PI / 2;
                const r = 80;
                const x = 100 + Math.cos(ang) * r;
                const y = 100 + Math.sin(ang) * r;
                const col = node.compromised ? "#ff3366" : "#00ff88";
                return (
                  <g key={node.ip}>
                    <line x1={100} y1={100} x2={x} y2={y} stroke={`${col}55`} strokeWidth={1} />
                    <circle cx={x} cy={y} r={node.compromised ? 5 : 4} fill={col}>
                      <animate attributeName="opacity" values="0.5;1;0.5" dur={`${1.5 + (i % 3) * 0.5}s`} repeatCount="indefinite" />
                    </circle>
                  </g>
                );
              })}
              {/* core */}
              <circle cx={100} cy={100} r={8} fill="#00d4ff" />
              <circle cx={100} cy={100} r={8} fill="none" stroke="#00d4ff" strokeWidth={1}>
                <animate attributeName="r" values="8;16;8" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2.5s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {model.nodes.map((node) => (
              <div key={node.ip} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, border: `1px solid ${node.compromised ? "#ff336633" : "rgba(0,212,255,0.14)"}`, background: node.compromised ? "#ff33660d" : "rgba(0,212,255,0.04)" }}>
                <span className="sv-dot" style={{ background: node.compromised ? "#ff3366" : "#00ff88", boxShadow: `0 0 8px ${node.compromised ? "#ff3366" : "#00ff88"}` }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{node.ip}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: node.compromised ? "#ff3366" : "var(--text-muted)" }}>{node.compromised ? "COMPROMISED" : "SECURE"} · {node.hits}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Telemetry + event log */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
        <Card delay={0.05}>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.16em", marginBottom: 12 }}>LIVE TELEMETRY</div>
            <div className="sv-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Active Threats", value: model.telemetry.activeThreats, color: "#ff3366" },
                { label: "Nodes", value: model.telemetry.nodes, color: "#00d4ff" },
                { label: "Compromised", value: model.telemetry.compromised, color: "#ff9900" },
                { label: "Packet Queue", value: model.telemetry.packetQueue, color: "#00ff88" },
              ].map((m) => (
                <div key={m.label} style={{ padding: "11px 12px", borderRadius: 10, border: "1px solid rgba(0,212,255,0.12)", background: "rgba(0,212,255,0.04)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: m.color, textShadow: `0 0 12px ${m.color}55` }}>{m.value}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{m.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card tilt={false} delay={0.1}>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.16em", marginBottom: 12 }}>EVENT STREAM</div>
            {model.log.length === 0 ? (
              <StateMessage state="empty" compact emptyHint="No events captured yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10.5, maxHeight: 260, overflowY: "auto" }}>
                {model.log.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(0,212,255,0.06)", animation: "sv-rise 0.4s ease both", animationDelay: `${i * 0.04}s` }}>
                    <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{l.time}</span>
                    <span style={{ color: levelColor[l.level] ?? "#00d4ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
