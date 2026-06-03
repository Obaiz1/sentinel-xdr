"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { api, type Statistics, type AlertsResponse, type ChainsResponse } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

/**
 * ExecutiveOverview — leadership summary (screenshot 13).
 * 100% derived from EXISTING telemetry (/statistics, /alerts, /chains).
 * The "Security Posture Score" is a transparent heuristic — labelled DERIVED,
 * never presented as a backend-provided metric.
 */

interface Combined {
  stats: Statistics;
  alerts: AlertsResponse;
  chains: ChainsResponse;
}

const LEVEL_COLOR: Record<string, string> = {
  Critical: "#ff3366",
  High: "#ff9900",
  Medium: "#a855f7",
  Low: "#00ff88",
};

const tooltipStyle = {
  background: "#040a14",
  border: "1px solid rgba(0,212,255,0.4)",
  borderRadius: 8,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "#e2e8f0",
};

function Gauge({ score }: { score: number }) {
  const color = score >= 75 ? "#00ff88" : score >= 50 ? "#ff9900" : "#ff3366";
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140" style={{ filter: `drop-shadow(0 0 10px ${color}55)` }}>
      <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(0,212,255,0.12)" strokeWidth={10} />
      <circle
        cx={70} cy={70} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`} transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease" }}
      />
      <text x={70} y={66} textAnchor="middle" fontFamily="var(--font-display)" fontSize={30} fill={color}>{score}</text>
      <text x={70} y={88} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="#4a6080">/ 100</text>
    </svg>
  );
}

function Bar2({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: "rgba(0,212,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, boxShadow: `0 0 10px ${color}`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function ExecutiveOverview() {
  const { data, state, refetch } = usePolling<Combined>(
    async (signal) => {
      const [stats, alerts, chains] = await Promise.all([
        api.getStatistics({ signal }),
        api.getAlerts({ limit: 50 }),
        api.getChains({ signal }),
      ]);
      return { stats, alerts, chains };
    },
    6000,
  );

  const derived = useMemo(() => {
    if (!data) return null;
    const dist = data.stats.threat_distribution ?? [];
    const total = dist.reduce((s, d) => s + d.count, 0);
    const by = (lvl: string) => dist.find((d) => d.threat_level === lvl)?.count ?? 0;
    const critical = by("Critical");
    const high = by("High");
    const weighted = total > 0 ? (critical * 1 + high * 0.6 + by("Medium") * 0.3 + by("Low") * 0.1) / total : 0;
    // Posture: 100 = nominal, drops with severity mix. Heuristic, not a backend metric.
    const posture = Math.max(0, Math.min(100, Math.round(100 - weighted * 100)));
    const readiness = Math.max(0, Math.min(100, posture + (data.chains.chains?.length ? -5 : 5)));
    const exposurePct = total > 0 ? Math.round(((critical + high) / total) * 100) : 0;
    const exposureLabel = critical > 0 ? "Critical" : high > 0 ? "Elevated" : "Nominal";
    const activeThreats = (data.alerts.alerts ?? [])
      .filter((a) => a.threat_level === "Critical" || a.threat_level === "High")
      .slice(0, 5);
    const roi = (data.stats.threat_timeline ?? []).map((t) => ({ t: t.minute_bucket?.slice(-5) ?? "", count: t.count }));
    return { posture, readiness, exposurePct, exposureLabel, activeThreats, roi, critical, high };
  }, [data]);

  if (state !== "data" || !derived) {
    return (
      <Card tilt={false}>
        <StateMessage state={state === "data" ? "empty" : state} onRetry={refetch} emptyHint="No telemetry yet. Start Demo Mode or the sniffer to compute the executive posture." />
      </Card>
    );
  }

  const postureColor = derived.posture >= 75 ? "#00ff88" : derived.posture >= 50 ? "#ff9900" : "#ff3366";
  const statusLabel = derived.posture >= 75 ? "NOMINAL" : derived.posture >= 50 ? "ELEVATED" : "CRITICAL";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>GLOBAL INFRASTRUCTURE STATUS:</span>
        <span className="sv-pill" style={{ color: postureColor, border: `1px solid ${postureColor}44`, background: `${postureColor}14` }}>
          <span className="sv-dot sv-pulse-dot" style={{ background: postureColor, boxShadow: `0 0 8px ${postureColor}` }} />
          {statusLabel}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", border: "1px solid rgba(0,212,255,0.18)", padding: "4px 8px", borderRadius: 6 }}>
          DERIVED FROM LIVE TELEMETRY
        </span>
      </div>

      <div className="sv-grid sv-grid-2">
        {/* Security Posture Score */}
        <Card delay={0}>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: "0.16em", marginBottom: 14 }}>SECURITY POSTURE SCORE</div>
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              <Gauge score={derived.posture} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <Bar2 label="Readiness" pct={derived.readiness} color="#00ff88" />
                <Bar2 label="Risk Exposure" pct={derived.exposurePct} color={derived.exposurePct > 50 ? "#ff3366" : "#ff9900"} />
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)" }}>
                  Exposure level: <span style={{ color: derived.exposureLabel === "Critical" ? "#ff3366" : "#ff9900" }}>{derived.exposureLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Active Threats */}
        <Card delay={0.05}>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: "0.16em", marginBottom: 14 }}>ACTIVE THREATS</div>
            {derived.activeThreats.length === 0 ? (
              <StateMessage state="empty" compact emptyHint="No active critical/high threats in the current window." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {derived.activeThreats.map((a) => {
                  const color = LEVEL_COLOR[a.threat_level ?? "Low"] ?? "#00d4ff";
                  return (
                    <div key={String(a.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, border: `1px solid ${color}33`, background: `${color}0d` }}>
                      <span className="sv-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.attack_vector ?? "Anomaly"}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)" }}>{a.src_ip ?? "?"} → {a.dst_ip ?? "?"} · {a.mitre_technique ?? "—"}</div>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color, border: `1px solid ${color}55`, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{(a.threat_level ?? "").toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Risk Mitigation / ROI Impact — from threat timeline */}
      <Card tilt={false} delay={0.1}>
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <span className="sv-dot" style={{ background: "#00d4ff", boxShadow: "0 0 8px #00d4ff" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11.5, letterSpacing: "0.14em" }}>RISK MITIGATION & DETECTION IMPACT</span>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            {derived.roi.length === 0 ? (
              <StateMessage state="empty" compact emptyHint="Timeline populates once telemetry flows." />
            ) : (
              <ResponsiveContainer>
                <BarChart data={derived.roi}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.08)" />
                  <XAxis dataKey="t" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "#4a6080" }} axisLine={{ stroke: "rgba(0,212,255,0.2)" }} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,212,255,0.06)" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {derived.roi.map((_, i) => <Cell key={i} fill={i % 2 ? "#00d4ff" : "#a855f7"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
