"use client";

import { useState } from "react";
import { api, ApiError, type EngineId, type EngineResult } from "@/lib/apiClient";
import Card from "./Card";

type EngineKind = "backend" | "ndr" | "edr";

interface EngineDef {
  id?: EngineId;
  kind?: EngineKind; // default "backend"
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
  { kind: "ndr", code: "NDR", name: "Network Detection", desc: "Analyze packet/session metadata: protocols, sources, vectors.", color: "#00d4ff" },
  { kind: "edr", code: "EDR", name: "Endpoint Detection", desc: "Endpoint/process/security-log analysis (needs a local agent).", color: "#ff9900" },
  { id: "aegis", code: "AEGIS", name: "AI Evasion Defense", desc: "Detect prompt-injection & adversarial evasion.", color: "#ffd700" },
  { id: "chronicle", code: "CHRONICLE", name: "Incident Narrative", desc: "Executive incident reports from the LLM.", color: "#ff3366" },
];

function EngineCard({ def, delay }: { def: EngineDef; delay: number }) {
  const kind = def.kind ?? "backend";
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  async function run() {
    setRunning(true); setErr(null); setNotConnected(false);
    try {
      if (kind === "edr") {
        // No backend/agent — honest "not connected" state, never faked.
        setNotConnected(true);
        return;
      }
      if (kind === "ndr") {
        // Real network analysis derived from /statistics (no fake data).
        const s = await api.getStatistics();
        const proto = s.protocol_breakdown ?? [];
        const vectors = s.top_attack_vectors ?? [];
        const sources = s.top_sources ?? [];
        if (!proto.length && !sources.length) {
          setResult({ status: "empty", title: "No network telemetry", summary: "Start Demo Mode or the local sniffer to analyze sessions." });
        } else {
          setResult({
            status: "success",
            title: "Network analysis complete",
            summary: `${proto.length} protocol(s), ${sources.length} active source(s) analyzed.`,
            items: [
              ...proto.slice(0, 2).map((p) => ({ label: p.protocol, value: p.count })),
              ...vectors.slice(0, 2).map((v) => ({ label: v.attack_vector, value: v.count })),
            ],
          });
        }
        return;
      }
      const r = await api.runEngine(def.id as EngineId);
      setResult(r);
    } catch (e) {
      if (e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout")) setErr("Backend offline — start it to run this engine.");
      else setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const statusColor = notConnected ? "var(--neon-orange)"
    : result?.status === "success" ? "var(--neon-green)"
    : result?.status === "error" ? "var(--neon-red)"
    : result?.status ? "var(--neon-orange)" : "var(--text-muted)";

  return (
    <Card delay={delay}>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.12em", color: def.color, textShadow: `0 0 12px ${def.color}66` }}>{def.code}</span>
          {kind === "edr" ? (
            <span className="cc-badge" style={{ color: "var(--neon-orange)", border: "1px solid rgba(255,153,0,0.4)", background: "rgba(255,153,0,0.12)" }}>LOCAL AGENT</span>
          ) : (
            <span className="sv-dot sv-pulse-dot" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
          )}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{def.name}</div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>{def.desc}</p>
        </div>

        {(result || err || notConnected) && (
          <div style={{ borderTop: "1px solid rgba(0,212,255,0.1)", paddingTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5 }}>
            {notConnected ? (
              <span style={{ color: "var(--neon-orange)" }}>Not connected. EDR requires a Local Authorized Agent on the target host — not available in cloud / this backend.</span>
            ) : err ? (
              <span style={{ color: "#ff9bb3" }}>{err}</span>
            ) : (
              <>
                {result?.title && <div style={{ color: def.color, marginBottom: 4 }}>{result.title}</div>}
                {result?.summary && <div style={{ color: "var(--text-primary)" }}>{result.summary}</div>}
                {result?.items?.slice(0, 4).map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginTop: 3 }}>
                    <span>{it.label}</span><span style={{ color: "var(--neon-blue)" }}>{String(it.value)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <button type="button" className="sv-btn" disabled={running} onClick={run} style={{ marginTop: "auto", borderColor: `${def.color}66`, color: def.color, background: `${def.color}12` }}>
          {running ? "Running…" : kind === "edr" ? "▶ Check Agent" : kind === "ndr" ? "▶ Analyze Network" : "▶ Run Engine"}
        </button>
      </div>
    </Card>
  );
}

export default function XDREngineSuite() {
  return (
    <div className="sv-grid sv-grid-3">
      {ENGINES.map((e, i) => <EngineCard key={e.code} def={e} delay={i * 0.05} />)}
    </div>
  );
}
