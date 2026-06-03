"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api, type Alert, type Chain } from "@/lib/apiClient";
import { downloadReport } from "@/lib/pdfReport";

const sevColor: Record<string, string> = { Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88" };
const TYPES = ["All", "Alerts", "Chains"] as const;
const SEVS = ["All", "Critical", "High", "Medium", "Low"] as const;

function asList(v: string[] | string | undefined): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.join(" ");
  try { const p = JSON.parse(v); return Array.isArray(p) ? p.join(" ") : String(v); } catch { return String(v); }
}
function fmt(ts?: string): string { try { return ts ? new Date(ts).toLocaleString() : ""; } catch { return ts ?? ""; } }

interface Result { key: string; category: "Alert" | "MACE Chain"; title: string; field: string; value: string; severity?: string; timestamp?: string; view: string }

export default function SearchOverlay({ onClose, onNavigate, onOpenAria }: { onClose: () => void; onNavigate: (v: string) => void; onOpenAria: () => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [sev, setSev] = useState<(typeof SEVS)[number]>("All");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, c] = await Promise.all([api.getAlerts({ limit: 200 }), api.getChains()]);
        if (!cancelled) { setAlerts(a.alerts ?? []); setChains(c.chains ?? []); }
      } catch { /* offline → empty */ } finally { if (!cancelled) setLoading(false); }
    })();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelled = true; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const out: Result[] = [];
    const match = (obj: Record<string, unknown>, fields: string[]): { field: string; value: string } | null => {
      for (const f of fields) { const v = obj[f]; if (v != null && String(v).toLowerCase().includes(term)) return { field: f, value: String(v) }; }
      return null;
    };
    if (type !== "Chains") {
      for (const a of alerts) {
        if (sev !== "All" && a.threat_level !== sev) continue;
        const node_id = `N-${String(a.id).replace(/\D/g, "").slice(-4).padStart(4, "0")}`;
        const hay = { ...a, node_id } as unknown as Record<string, unknown>;
        const m = term ? match(hay, ["src_ip", "dst_ip", "attack_vector", "mitre_technique", "protocol", "threat_level", "node_id", "explanation", "status", "id"]) : { field: "vector", value: a.attack_vector ?? "Anomaly" };
        if (m) out.push({ key: `a${a.id}`, category: "Alert", title: `${a.attack_vector ?? "Anomaly"} · ${a.src_ip ?? "?"}→${a.dst_ip ?? "?"}`, field: m.field, value: m.value, severity: a.threat_level, timestamp: a.timestamp, view: "alerts" });
      }
    }
    if (type !== "Alerts") {
      for (const c of chains) {
        const hay = { chain_id: c.chain_id, actor_id: c.actor_id, phases: asList(c.kill_chain_phases), techniques: asList(c.mitre_techniques), intent: c.attacker_intent, status: c.status } as Record<string, unknown>;
        const m = term ? match(hay, ["chain_id", "actor_id", "phases", "techniques", "intent", "status"]) : { field: "chain", value: String(c.chain_id) };
        if (m) out.push({ key: `c${c.chain_id}`, category: "MACE Chain", title: `${c.chain_id} · score ${c.chain_score ?? 0}`, field: m.field, value: m.value, timestamp: c.last_seen, view: "chains" });
      }
    }
    return out.slice(0, 60);
  }, [q, type, sev, alerts, chains]);

  function pick(r: Result) { onNavigate(r.view); onClose(); }

  return (
    <>
      <motion.div className="cc-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="cc-search" role="dialog" aria-modal initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.2 }}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Query system — IP, vector, MITRE, severity, chain, node id…"
          style={{ width: "100%", height: 42, padding: "0 14px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {TYPES.map((t) => <button key={t} type="button" onClick={() => setType(t)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 10px", borderRadius: 999, cursor: "pointer", minHeight: 28, border: `1px solid ${type === t ? "rgba(0,212,255,0.5)" : "rgba(74,96,128,0.3)"}`, background: type === t ? "rgba(0,212,255,0.12)" : "transparent", color: type === t ? "var(--neon-blue)" : "var(--text-muted)" }}>{t}</button>)}
          <span style={{ width: 1, alignSelf: "stretch", background: "rgba(0,212,255,0.15)", margin: "0 2px" }} />
          {SEVS.map((s) => <button key={s} type="button" onClick={() => setSev(s)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 10px", borderRadius: 999, cursor: "pointer", minHeight: 28, border: `1px solid ${sev === s ? (sevColor[s] ?? "rgba(0,212,255,0.5)") : "rgba(74,96,128,0.3)"}`, background: sev === s ? `${sevColor[s] ?? "#00d4ff"}1f` : "transparent", color: sev === s ? (sevColor[s] ?? "var(--neon-blue)") : "var(--text-muted)" }}>{s}</button>)}
        </div>

        <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)" }}>{loading ? "Loading telemetry…" : `${results.length} result${results.length === 1 ? "" : "s"}`}</div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 6, display: "flex", flexDirection: "column" }}>
          {results.length === 0 ? (
            <div style={{ padding: "26px 10px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{loading ? "" : "No matches. Try an IP, vector (e.g. SYN), MITRE id, or severity."}</div>
          ) : results.map((r) => {
            const c = r.severity ? (sevColor[r.severity] ?? "#00d4ff") : (r.category === "MACE Chain" ? "#ff9900" : "#00d4ff");
            return (
              <button key={r.key} type="button" onClick={() => pick(r)} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", textAlign: "left", padding: "9px 8px", minHeight: 44, cursor: "pointer", border: "none", borderBottom: "1px solid rgba(0,212,255,0.07)", background: "transparent" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, padding: "3px 7px", borderRadius: 6, color: c, border: `1px solid ${c}55`, background: `${c}12`, whiteSpace: "nowrap" }}>{r.category.toUpperCase()}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>matched <b style={{ color: "var(--neon-blue)" }}>{r.field}</b>: {r.value.slice(0, 48)}{r.timestamp ? ` · ${fmt(r.timestamp)}` : ""}</span>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>→</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" className="sv-btn" style={{ flex: 1, minWidth: 150, borderColor: "rgba(168,85,247,0.5)", color: "var(--neon-purple)", background: "rgba(168,85,247,0.12)" }} onClick={() => { onOpenAria(); onClose(); }}>💬 Ask ARIA about these</button>
          <button type="button" className="sv-btn" style={{ flex: 1, minWidth: 150 }} onClick={() => downloadReport(type === "Chains" ? "mace" : type === "Alerts" ? "alerts" : "full")}>📄 Generate report</button>
          <button type="button" className="sv-btn sv-btn-ghost" style={{ minWidth: 80 }} onClick={onClose}>Esc</button>
        </div>
      </motion.div>
    </>
  );
}
