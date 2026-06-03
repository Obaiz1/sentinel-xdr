"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { api, type SystemStatus, type Statistics, type AlertsResponse, type ChainsResponse } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import StateMessage from "./StateMessage";
import { IconWifi, IconWarning, IconScan, IconBell, IconNetwork, IconGauge } from "./Icons";

const HeroGlobe = dynamic(() => import("@/components/HeroGlobe"), { ssr: false });

interface Combined { status: SystemStatus; stats: Statistics; alerts: AlertsResponse; chains: ChainsResponse }

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function Kpi({ icon, color, value, label, badge, badgeColor }: { icon: ReactNode; color: string; value: string; label: string; badge?: string; badgeColor?: string }) {
  return (
    <div className="cc-kpi">
      <div className="cc-kpi-top">
        <span className="cc-kpi-ico" style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}>{icon}</span>
        {badge && <span className="cc-kpi-badge" style={{ color: badgeColor ?? color, background: `${badgeColor ?? color}14`, border: `1px solid ${badgeColor ?? color}33` }}>{badge}</span>}
      </div>
      <div className="cc-kpi-val" style={{ color, textShadow: `0 0 16px ${color}55` }}>{value}</div>
      <div className="cc-kpi-label">{label}</div>
    </div>
  );
}

export default function CommandCenter() {
  const { data, state, refetch } = usePolling<Combined>(
    async (signal) => {
      const [status, stats, alerts, chains] = await Promise.all([
        api.getStatus({ signal }), api.getStatistics({ signal }), api.getAlerts({ limit: 1 }), api.getChains({ signal }),
      ]);
      return { status, stats, alerts, chains };
    },
    4000,
  );

  const k = useMemo(() => {
    if (!data) return null;
    const dist = data.stats.threat_distribution ?? [];
    const critical = dist.find((d) => d.threat_level === "Critical")?.count ?? 0;
    return {
      packets: data.status.sniffer?.packets_captured ?? 0,
      critical,
      analyzed: data.status.llm_analyzer?.analyzed_count ?? 0,
      alerts: data.alerts.pagination?.total ?? 0,
      chains: data.chains.chains?.length ?? 0,
      queue: data.status.queues?.packet_queue_size ?? 0,
      queueMax: data.status.queues?.packet_queue_max ?? 0,
      snifferOn: !!data.status.sniffer?.is_running,
      demo: !!data.status.demo?.running,
    };
  }, [data]);

  const queueColor = k && k.queueMax > 0 && k.queue / k.queueMax > 0.8 ? "#ff3366" : "#00ff88";

  return (
    <div>
      {/* ── HUD monitoring panel ── */}
      <div className="cc-hud">
        <div style={{ position: "absolute", inset: 0 }}><HeroGlobe /></div>
        <div className="sv-radar" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(0,212,255,0.12) 28deg, transparent 56deg)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 38%, #03070f 82%)" }} />

        <div className="cc-hud-tag" style={{ top: 14, left: 14 }}>
          <div style={{ color: "var(--neon-green)" }}>◉ SYS-MONITORING: {k?.snifferOn ? "ACTIVE" : "IDLE"}</div>
          <div style={{ color: "var(--text-muted)", marginTop: 4 }}>LAT: 31.5204 N</div>
          <div style={{ color: "var(--text-muted)" }}>LON: 74.3587 E</div>
          {k?.demo && <div style={{ color: "var(--neon-orange)", marginTop: 4 }}>DEMO MODE</div>}
        </div>

        {k && k.critical > 0 && (
          <div className="cc-hud-callout" style={{ top: "44%", right: "14%" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>⟁ INTERCEPT ORIGIN</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, marginTop: 2 }}>LAHORE, PK</div>
          </div>
        )}
      </div>

      {/* ── KPI grid ── */}
      {state !== "data" || !k ? (
        <div className="cc-kpis"><div style={{ gridColumn: "1 / -1" }}><div className="sv-card"><StateMessage state={state} onRetry={refetch} compact /></div></div></div>
      ) : (
        <div className="cc-kpis">
          <Kpi icon={<IconWifi />} color="#00d4ff" value={fmt(k.packets)} label="Packets Captured" badge={k.snifferOn ? "LIVE" : "IDLE"} badgeColor={k.snifferOn ? "#00ff88" : "#ff9900"} />
          <Kpi icon={<IconWarning />} color="#ff3366" value={String(k.critical)} label="Critical Threats" />
          <Kpi icon={<IconScan />} color="#00ff88" value={fmt(k.analyzed)} label="AI Analyzed" />
          <Kpi icon={<IconBell />} color="#ff9900" value={fmt(k.alerts)} label="Alerts Detected" badge="24H" badgeColor="#4a6080" />
          <Kpi icon={<IconNetwork />} color="#a855f7" value={String(k.chains).padStart(2, "0")} label="Active Chains" />
          <Kpi icon={<IconGauge />} color={queueColor} value={`${k.queue}${k.queueMax ? `/${k.queueMax}` : ""}`} label="Queue Load" badge={queueColor === "#00ff88" ? "STABLE" : "HIGH"} badgeColor={queueColor} />
        </div>
      )}
    </div>
  );
}
