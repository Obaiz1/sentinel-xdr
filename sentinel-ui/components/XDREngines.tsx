"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { backendPost } from "@/lib/backend";

interface EngineResult {
  engine: string;
  status: "success" | "error" | "empty" | "not_configured";
  title: string;
  summary: string;
  metrics?: Record<string, string | number>;
  items?: { label: string; value: string }[];
  timestamp?: number;
}

type RunState = "idle" | "running" | "success" | "error";

const ENGINES = [
  { code: "MACE", name: "Multi-Stage Attack Correlation", color: "#00d4ff", desc: "Correlates distributed events into unified kill chains using graph-based pattern matching." },
  { code: "ARIA", name: "AI Security Copilot", color: "#00ff88", desc: "AI-powered SOC analyst with full situational awareness. Generates a live threat summary." },
  { code: "ADRS", name: "Autonomous Defence Response", color: "#ff9900", desc: "Policy-driven IP-block evaluation with false-positive gating (safe non-destructive dry-run)." },
  { code: "PHANTOM", name: "Attacker Memory Profiling", color: "#a855f7", desc: "Tracks adversaries across sessions, building behavioural fingerprints over time." },
  { code: "AEGIS", name: "AI Evasion Detection", color: "#ff3366", desc: "Scans payloads for LLM prompt injections / AI-evasion patterns before they reach the model." },
  { code: "CHRONICLE", name: "Incident Storytelling", color: "#00d4ff", desc: "Generates executive-ready C-suite incident narratives from raw MACE attack chains." },
];

const STATUS_COLOR: Record<string, string> = {
  idle: "var(--text-muted)",
  running: "#ff9900",
  success: "#00ff88",
  error: "#ff3366",
};

export default function XDREngines() {
  const [runState, setRunState] = useState<Record<string, RunState>>({});
  const [result, setResult] = useState<EngineResult | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const runEngine = async (code: string) => {
    if (runState[code] === "running") return;
    setRunState((s) => ({ ...s, [code]: "running" }));
    setActiveCode(code);
    setResult(null);
    try {
      const data = await backendPost<EngineResult>(`/api/engines/${code.toLowerCase()}/run`, {});
      setResult(data);
      setRunState((s) => ({ ...s, [code]: data.status === "error" ? "error" : "success" }));
    } catch {
      setRunState((s) => ({ ...s, [code]: "error" }));
      setResult({
        engine: code,
        status: "error",
        title: code,
        summary:
          "Backend unavailable. Start the SENTINEL backend (uvicorn) and set NEXT_PUBLIC_API_URL so the dashboard can reach it.",
      });
    }
  };

  const statusLabel = (s: RunState | undefined) =>
    s === "running" ? "RUNNING" : s === "success" ? "READY" : s === "error" ? "ERROR" : "IDLE";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 12 }}>
        {ENGINES.map((eng) => {
          const st = runState[eng.code];
          const isActive = activeCode === eng.code;
          return (
            <motion.button
              key={eng.code}
              type="button"
              onClick={() => runEngine(eng.code)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className="glass-card"
              style={{
                textAlign: "left",
                padding: "16px 18px",
                borderLeft: `2px solid ${eng.color}`,
                background: `linear-gradient(135deg, ${eng.color}0d, transparent)`,
                cursor: st === "running" ? "wait" : "pointer",
                outline: isActive ? `1px solid ${eng.color}66` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)", fontSize: 9, color: eng.color,
                    letterSpacing: "0.2em", padding: "2px 8px",
                    border: `1px solid ${eng.color}44`, borderRadius: 4,
                  }}
                >
                  {eng.code}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-primary)", fontWeight: 700 }}>
                  {eng.name}
                </span>
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 8.5, color: STATUS_COLOR[st || "idle"], letterSpacing: "0.1em" }}>
                  <span
                    className={st === "running" ? "pulse-dot" : ""}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[st || "idle"], boxShadow: `0 0 6px ${STATUS_COLOR[st || "idle"]}` }}
                  />
                  {statusLabel(st)}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>{eng.desc}</p>
              <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 9.5, color: eng.color, letterSpacing: "0.12em" }}>
                {st === "running" ? "⟳ RUNNING…" : "▶ RUN ENGINE"}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Output panel */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden", marginTop: 14 }}
          >
            <div
              className="glass-card"
              style={{
                padding: "18px 20px",
                borderColor:
                  result.status === "error" ? "rgba(255,51,102,0.35)" : "rgba(0,212,255,0.3)",
                background: "rgba(0,20,50,0.55)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--neon-blue)", letterSpacing: "0.15em" }}>
                  {(result.engine || "").toUpperCase()} · {result.title}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
                    padding: "2px 8px", borderRadius: 4,
                    color:
                      result.status === "error" ? "#ff3366"
                      : result.status === "success" ? "#00ff88"
                      : "#a855f7",
                    border: `1px solid ${result.status === "error" ? "#ff336644" : result.status === "success" ? "#00ff8844" : "#a855f744"}`,
                  }}
                >
                  {result.status.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => { setResult(null); setActiveCode(null); }}
                  style={{
                    marginLeft: "auto", cursor: "pointer", background: "transparent",
                    border: "1px solid rgba(0,212,255,0.2)", borderRadius: 6,
                    color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px",
                  }}
                >
                  ✕ Close
                </button>
              </div>

              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
                {result.summary}
              </p>

              {result.metrics && Object.keys(result.metrics).length > 0 && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(result.metrics).map(([k, v]) => (
                    <span key={k} style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 10px", borderRadius: 6,
                      border: "1px solid rgba(0,212,255,0.25)", background: "rgba(0,212,255,0.06)", color: "var(--neon-blue)",
                    }}>
                      {k.replace(/_/g, " ")}: <span style={{ color: "var(--text-primary)" }}>{String(v)}</span>
                    </span>
                  ))}
                </div>
              )}

              {result.items && result.items.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {result.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      <span style={{ color: "var(--neon-purple)", minWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.label}>{it.label}</span>
                      <span style={{ color: "var(--text-muted)", flex: 1 }}>{it.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
