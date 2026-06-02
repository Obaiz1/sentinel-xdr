"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type Alert, type AlertsResponse } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

const LEVELS = ["All", "Critical", "High", "Medium", "Low"] as const;
type Level = (typeof LEVELS)[number];

const levelColor: Record<string, string> = {
  Critical: "var(--neon-red)",
  High: "var(--neon-orange)",
  Medium: "var(--neon-purple)",
  Low: "var(--neon-green)",
};

function AlertRow({ alert }: { alert: Alert }) {
  const [open, setOpen] = useState(false);
  const color = levelColor[alert.threat_level ?? "Low"] ?? "var(--neon-blue)";
  const time = (() => {
    try { return new Date(alert.timestamp).toLocaleTimeString(); } catch { return alert.timestamp; }
  })();

  return (
    <div style={{ borderBottom: "1px solid rgba(0,212,255,0.08)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center",
          padding: "11px 4px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", minHeight: 44,
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "3px 8px", borderRadius: 6, color, border: `1px solid ${color}55`, background: `${color}14`, whiteSpace: "nowrap" }}>
          {(alert.threat_level ?? "—").toUpperCase()}
        </span>
        <span style={{ minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alert.attack_vector ?? "Anomaly"} · <span style={{ color: "var(--text-muted)" }}>{alert.src_ip ?? "?"}→{alert.dst_ip ?? "?"} {alert.protocol ?? ""}</span>
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {alert.confidence != null ? `${Math.round(alert.confidence)}%` : ""} {time}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "4px 4px 14px", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, color: "var(--text-muted)" }}>
              {alert.mitre_technique && <div>MITRE: <span style={{ color }}>{alert.mitre_technique}</span></div>}
              {(alert.src_port || alert.dst_port) && <div>Ports: {alert.src_port ?? "?"} → {alert.dst_port ?? "?"}</div>}
              {alert.tcp_flags && <div>Flags: {alert.tcp_flags}</div>}
              {alert.explanation && <div style={{ color: "var(--text-primary)", marginTop: 4 }}>{alert.explanation}</div>}
              {alert.recommended_action && <div style={{ color: "var(--neon-green)", marginTop: 4 }}>→ {alert.recommended_action}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LiveAlertsStream() {
  const [level, setLevel] = useState<Level>("All");
  const { data, state, refetch } = usePolling<AlertsResponse>(
    () => api.getAlerts({ limit: 50 }),
    3000,
    (d) => !d.alerts?.length,
  );

  const filtered = useMemo(() => {
    const all = data?.alerts ?? [];
    return level === "All" ? all : all.filter((a) => a.threat_level === level);
  }, [data, level]);

  return (
    <Card tilt={false}>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
          {LEVELS.map((l) => (
            <button
              key={l} type="button" onClick={() => setLevel(l)}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer", minHeight: 32,
                border: `1px solid ${level === l ? "rgba(0,212,255,0.5)" : "rgba(74,96,128,0.3)"}`,
                background: level === l ? "rgba(0,212,255,0.12)" : "transparent",
                color: level === l ? "var(--neon-blue)" : "var(--text-muted)",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {state !== "data" ? (
          <StateMessage state={state} onRetry={refetch} emptyHint="No alerts yet. Start Demo Mode or the sniffer to see live detections." />
        ) : filtered.length === 0 ? (
          <StateMessage state="empty" emptyHint={`No ${level} alerts in the current window.`} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.map((a) => <AlertRow key={String(a.id)} alert={a} />)}
          </div>
        )}
      </div>
    </Card>
  );
}
