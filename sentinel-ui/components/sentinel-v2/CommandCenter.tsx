"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { api, type SystemStatus, type Statistics, type AlertsResponse, type ChainsResponse } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import StateMessage from "./StateMessage";
import { useNav } from "./NavContext";
import { IconWifi, IconWarning, IconScan, IconBell, IconNetwork, IconGauge } from "./Icons";

const HeroGlobe = dynamic(() => import("@/components/HeroGlobe"), { ssr: false });

interface Combined { status: SystemStatus; stats: Statistics; alerts: AlertsResponse; chains: ChainsResponse }

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/** Telemetry source chip — Demo / Live / Backend / Empty. */
function sourceChip(demo: boolean, sniffer: boolean, hasData: boolean): { text: string; color: string } {
  if (demo) return { text: "Demo telemetry", color: "#a855f7" };
  if (sniffer) return { text: "Live capture", color: "#00ff88" };
  if (hasData) return { text: "Backend", color: "#00d4ff" };
  return { text: "No telemetry", color: "#4a6080" };
}

function Kpi({ icon, color, value, label, chip, onClick }: {
  icon: ReactNode; color: string; value: string; label: string;
  chip: { text: string; color: string }; onClick: () => void;
}) {
  return (
    <button type="button" className="cc-kpi" onClick={onClick} aria-label={`${label} — view details`}>
      <div className="cc-kpi-top">
        <span className="cc-kpi-ico" style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}>{icon}</span>
        <span className="cc-chip" style={{ color: chip.color, border: `1px solid ${chip.color}44`, background: `${chip.color}14` }}>
          <span className="sv-dot" style={{ background: chip.color }} />{chip.text}
        </span>
      </div>
      <div className="cc-kpi-val" style={{ color, textShadow: `0 0 16px ${color}55` }}>{value}</div>
      <div className="cc-kpi-label">{label}</div>
      <span className="cc-kpi-arrow" aria-hidden>→</span>
    </button>
  );
}

function DrawerRow({ label, value, color = "var(--neon-blue)" }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="cc-drawer-row">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

export default function CommandCenter() {
  const nav = useNav();
  const [drawer, setDrawer] = useState<"ai" | "queue" | null>(null);

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
  const st = data?.status;

  return (
    <div>
      {/* ── HUD monitoring panel ── */}
      <div className="cc-hud">
        <div style={{ position: "absolute", inset: 0 }}><HeroGlobe /></div>
        <div className="sv-radar" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(0,212,255,0.12) 28deg, transparent 56deg)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 38%, #03070f 82%)" }} />

        <div className="cc-hud-tag" style={{ top: 14, left: 14 }}>
          <div style={{ color: "var(--neon-green)" }}>◉ SYS-MONITORING: {k?.snifferOn ? "ACTIVE" : k?.demo ? "DEMO" : "IDLE"}</div>
          <div style={{ color: "var(--text-muted)", marginTop: 4 }}>LAT: 31.5204 N</div>
          <div style={{ color: "var(--text-muted)" }}>LON: 74.3587 E</div>
          {k?.demo && <div style={{ color: "var(--neon-purple)", marginTop: 4 }}>DEMO TELEMETRY</div>}
        </div>

        {k && k.critical > 0 && (
          <div className="cc-hud-callout" style={{ top: "44%", right: "14%" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>⟁ INTERCEPT ORIGIN</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, marginTop: 2 }}>LAHORE, PK</div>
          </div>
        )}
      </div>

      {/* ── KPI grid (clickable) ── */}
      {state !== "data" || !k ? (
        <div className="cc-kpis"><div style={{ gridColumn: "1 / -1" }}><div className="sv-card"><StateMessage state={state} onRetry={refetch} compact /></div></div></div>
      ) : (
        <div className="cc-kpis">
          <Kpi icon={<IconWifi />} color="#00d4ff" value={fmt(k.packets)} label="Packets Captured" chip={sourceChip(k.demo, k.snifferOn, k.packets > 0)} onClick={() => nav.navigate("control")} />
          <Kpi icon={<IconWarning />} color="#ff3366" value={String(k.critical)} label="Critical Threats" chip={sourceChip(k.demo, k.snifferOn, k.critical > 0)} onClick={() => { nav.setAlertFilter("Critical"); nav.navigate("alerts"); }} />
          <Kpi icon={<IconScan />} color="#00ff88" value={fmt(k.analyzed)} label="AI Analyzed" chip={sourceChip(k.demo, k.snifferOn, k.analyzed > 0)} onClick={() => setDrawer("ai")} />
          <Kpi icon={<IconBell />} color="#ff9900" value={fmt(k.alerts)} label="Alerts Detected" chip={sourceChip(k.demo, k.snifferOn, k.alerts > 0)} onClick={() => { nav.setAlertFilter(null); nav.navigate("alerts"); }} />
          <Kpi icon={<IconNetwork />} color="#a855f7" value={String(k.chains).padStart(2, "0")} label="Active Chains" chip={sourceChip(k.demo, k.snifferOn, k.chains > 0)} onClick={() => nav.navigate("chains")} />
          <Kpi icon={<IconGauge />} color={queueColor} value={`${k.queue}${k.queueMax ? `/${k.queueMax}` : ""}`} label="Queue Load" chip={sourceChip(k.demo, k.snifferOn, true)} onClick={() => setDrawer("queue")} />
        </div>
      )}

      {/* ── Detail drawer (AI analyzer / queue) ── */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="cc-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(null)} />
            <motion.div className="cc-drawer" initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: "tween", duration: 0.25 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.16em", color: drawer === "ai" ? "var(--neon-green)" : queueColor }}>
                  {drawer === "ai" ? "AI / LLM ANALYZER" : "QUEUE LOAD"}
                </span>
                <button type="button" onClick={() => setDrawer(null)} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 22, width: 32, height: 32 }}>×</button>
              </div>

              {drawer === "ai" ? (
                <>
                  <DrawerRow label="LLM analyzer" value={st?.llm_analyzer?.is_running ? "Running" : "Idle"} color={st?.llm_analyzer?.is_running ? "var(--neon-green)" : "var(--neon-orange)"} />
                  <DrawerRow label="Analyzed count" value={fmt(st?.llm_analyzer?.analyzed_count ?? 0)} color="var(--neon-green)" />
                  <DrawerRow label="LLM queue" value={`${st?.llm_analyzer?.queue_size ?? st?.queues?.llm_queue_size ?? 0}`} />
                  <DrawerRow label="RAG engine" value={st?.rag_engine?.initialized ? "Loaded" : "Offline"} color={st?.rag_engine?.initialized ? "var(--neon-green)" : "var(--neon-orange)"} />
                  <DrawerRow label="RAG documents" value={String(st?.rag_engine?.document_count ?? 0)} />
                  <DrawerRow label="Database" value={st?.database?.connected ? "Connected" : "Error"} color={st?.database?.connected ? "var(--neon-green)" : "var(--neon-red)"} />
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>
                    The LLM analyzer triages flagged packets via the backend (NVIDIA NIM). ARIA replies use the same backend through <b style={{ color: "var(--neon-purple)" }}>/api/aria/chat</b> — no keys in the browser.
                  </p>
                </>
              ) : (
                <>
                  <DrawerRow label="Packet queue" value={`${st?.queues?.packet_queue_size ?? 0} / ${st?.queues?.packet_queue_max ?? 0}`} color={queueColor} />
                  <DrawerRow label="LLM queue" value={`${st?.queues?.llm_queue_size ?? 0} / ${st?.queues?.llm_queue_max ?? 0}`} />
                  <DrawerRow label="Sniffer" value={st?.sniffer?.is_running ? "Running" : "Idle"} color={st?.sniffer?.is_running ? "var(--neon-green)" : "var(--text-muted)"} />
                  <DrawerRow label="Demo telemetry" value={st?.demo?.running ? "Active" : "Off"} color={st?.demo?.running ? "var(--neon-purple)" : "var(--text-muted)"} />
                  <button type="button" className="sv-btn" style={{ marginTop: 16, width: "100%" }} onClick={() => { setDrawer(null); nav.navigate("control"); }}>Open Control Panel →</button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
