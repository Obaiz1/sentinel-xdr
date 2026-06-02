"use client";

import { useState } from "react";
import { api, ApiError, type EngineId, type EngineResult } from "@/lib/apiClient";
import Card from "./Card";

interface EngineDef {
  id: EngineId;
  code: string;
  name: string;
  desc: string;
  color: string;
}

const ENGINES: EngineDef[] = [
  { id: "mace", code: "MACE", name: "Attack Chains", desc: "Correlate multi-stage attacks across the kill chain.", color: "#ff9900" },
  { id: "aria", code: "ARIA", name: "AI Copilot", desc: "Conversational SOC analyst with RAG context.", color: "#00d4ff" },
  { id: "adrs", code: "ADRS", name: "Auto Response", desc: "Autonomous response (non-destructive dry-run).", color: "#00ff88" },
  { id: "phantom", code: "PHANTOM", name: "Attacker Profiling", desc: "Persistent attacker memory & behavior profiles.", color: "#a855f7" },
  { id: "aegis", code: "AEGIS", name: "AI Evasion Defense", desc: "Detect prompt-injection & adversarial evasion.", color: "#ffd700" },
  { id: "chronicle", code: "CHRONICLE", name: "Incident Narrative", desc: "Executive incident reports from the LLM.", color: "#ff3366" },
];

function EngineCard({ def, delay }: { def: EngineDef; delay: number }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setErr(null);
    try {
      const r = await api.runEngine(def.id);
      setResult(r);
    } catch (e) {
      if (e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout")) setErr("Backend offline — start it to run this engine.");
      else setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const statusColor =
    result?.status === "success" ? "var(--neon-green)" :
    result?.status === "error" ? "var(--neon-red)" :
    result?.status ? "var(--neon-orange)" : "var(--text-muted)";

  return (
    <Card delay={delay}>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.12em", color: def.color, textShadow: `0 0 12px ${def.color}66` }}>
            {def.code}
          </span>
          <span className="sv-dot sv-pulse-dot" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{def.name}</div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>{def.desc}</p>
        </div>

        {(result || err) && (
          <div style={{ borderTop: "1px solid rgba(0,212,255,0.1)", paddingTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5 }}>
            {err ? (
              <span style={{ color: "#ff9bb3" }}>{err}</span>
            ) : (
              <>
                {result?.title && <div style={{ color: def.color, marginBottom: 4 }}>{result.title}</div>}
                {result?.summary && <div style={{ color: "var(--text-primary)" }}>{result.summary}</div>}
                {result?.items?.slice(0, 4).map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginTop: 3 }}>
                    <span>{it.label}</span>
                    <span style={{ color: "var(--neon-blue)" }}>{String(it.value)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <button type="button" className="sv-btn" disabled={running} onClick={run} style={{ marginTop: "auto", borderColor: `${def.color}66`, color: def.color, background: `${def.color}12` }}>
          {running ? "Running…" : "▶ Run Engine"}
        </button>
      </div>
    </Card>
  );
}

export default function XDREngineSuite() {
  return (
    <div className="sv-grid sv-grid-3">
      {ENGINES.map((e, i) => <EngineCard key={e.id} def={e} delay={i * 0.05} />)}
    </div>
  );
}
