"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type Alert, type AlertsResponse } from "@/lib/apiClient";
import { downloadReport } from "@/lib/pdfReport";
import { usePolling } from "./usePolling";
import StateMessage from "./StateMessage";

export type DetailKind = "packets" | "threats" | "ai" | "alerts";

const META: Record<DetailKind, { title: string; color: string; note?: string }> = {
  packets: { title: "Analyzed Packets", color: "#00d4ff", note: "Showing flagged/analyzed packets with metadata. (Full raw capture is not stored — only suspicious packets are retained.)" },
  threats: { title: "Critical Threats", color: "#ff3366" },
  ai: { title: "AI-Analyzed Events", color: "#00ff88" },
  alerts: { title: "Alerts Detected", color: "#ff9900" },
};

const levelColor: Record<string, string> = { Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88" };

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function fmtTime(ts?: string): string {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function Row({ alert, kind, color }: { alert: Alert; kind: DetailKind; color: string }) {
  const [open, setOpen] = useState(false);
  const sev = alert.threat_level ?? "Low";
  const sevC = levelColor[sev] ?? "#00d4ff";
  return (
    <div style={{ borderBottom: "1px solid rgba(0,212,255,0.08)" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", padding: "10px 4px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", minHeight: 44 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "3px 8px", borderRadius: 6, color: sevC, border: `1px solid ${sevC}55`, background: `${sevC}14`, whiteSpace: "nowrap" }}>{sev.toUpperCase()}</span>
        <span style={{ minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alert.attack_vector ?? "Anomaly"} · <span style={{ color: "var(--text-muted)" }}>{alert.src_ip ?? "?"}→{alert.dst_ip ?? "?"} {alert.protocol ?? ""}{alert.dst_port ? `:${alert.dst_port}` : ""}</span>
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {alert.confidence != null ? `${Math.round(alert.confidence)}%` : ""} ·#{alert.id}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "2px 6px 12px", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.65, color: "var(--text-muted)" }}>
              <div>Time: {fmtTime(alert.timestamp)}</div>
              <div>Source: {alert.src_ip ?? "?"}{alert.src_port ? `:${alert.src_port}` : ""} → Dest: {alert.dst_ip ?? "?"}{alert.dst_port ? `:${alert.dst_port}` : ""}</div>
              <div>Protocol: {alert.protocol ?? "—"} {alert.tcp_flags ? `· flags ${alert.tcp_flags}` : ""}</div>
              {alert.mitre_technique && <div>MITRE: <span style={{ color }}>{alert.mitre_technique}</span></div>}
              {(kind === "ai" || kind === "threats") && alert.explanation && <div style={{ color: "var(--text-primary)", marginTop: 4 }}>Analysis: {alert.explanation}</div>}
              {alert.recommended_action && <div style={{ color: "var(--neon-green)", marginTop: 4 }}>→ {alert.recommended_action}</div>}
              {alert.status && <div style={{ marginTop: 4 }}>Status: {alert.status}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DetailModal({ kind, onClose }: { kind: DetailKind; onClose: () => void }) {
  const meta = META[kind];
  const [proto, setProto] = useState("All");
  const [pdfBusy, setPdfBusy] = useState(false);

  async function makePdf() {
    setPdfBusy(true);
    try { await downloadReport(kind); } catch { /* surfaced via no download */ } finally { setPdfBusy(false); }
  }

  const { data, state, refetch } = usePolling<AlertsResponse>(
    () => api.getAlerts({ limit: 100, level: kind === "threats" ? "Critical" : undefined }),
    5000,
    (d) => !d.alerts?.length,
  );

  const alerts = useMemo(() => data?.alerts ?? [], [data]);
  const protocols = useMemo(() => ["All", ...Array.from(new Set(alerts.map((a) => a.protocol).filter(Boolean) as string[]))], [alerts]);
  const rows = proto === "All" ? alerts : alerts.filter((a) => a.protocol === proto);

  let body: ReactNode;
  if (state !== "data") {
    body = <StateMessage state={state} onRetry={refetch} emptyHint={`No ${kind === "threats" ? "critical threats" : kind === "ai" ? "AI-analyzed events" : kind === "packets" ? "analyzed packets" : "alerts"} yet. Start Demo Mode or the local sniffer.`} />;
  } else {
    body = (
      <>
        {protocols.length > 2 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {protocols.map((p) => (
              <button key={p} type="button" onClick={() => setProto(p)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 11px", borderRadius: 999, cursor: "pointer", minHeight: 30,
                  border: `1px solid ${proto === p ? "rgba(0,212,255,0.5)" : "rgba(74,96,128,0.3)"}`,
                  background: proto === p ? "rgba(0,212,255,0.12)" : "transparent",
                  color: proto === p ? "var(--neon-blue)" : "var(--text-muted)" }}>{p}</button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((a) => <Row key={String(a.id)} alert={a} kind={kind} color={meta.color} />)}
        </div>
      </>
    );
  }

  return (
    <>
      <motion.div className="cc-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="cc-modal" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ duration: 0.22 }} role="dialog" aria-modal>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span className="sv-dot" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.14em", color: meta.color }}>{meta.title}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>{rows.length} records</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="sv-btn" style={{ height: 32, minHeight: 32 }} disabled={pdfBusy} onClick={makePdf}>{pdfBusy ? "Generating…" : "📄 Generate PDF"}</button>
            <button type="button" className="sv-btn sv-btn-ghost" style={{ height: 32, minHeight: 32 }} onClick={() => downloadJson(`sentinel-${kind}.json`, rows)}>⤓ Export JSON</button>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 22, width: 32, height: 32 }}>×</button>
          </div>
        </div>
        {meta.note && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>{meta.note}</p>}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>{body}</div>
      </motion.div>
    </>
  );
}
