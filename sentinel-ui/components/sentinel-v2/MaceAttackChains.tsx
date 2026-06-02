"use client";

import { useState } from "react";
import { api, ApiError, type Chain, type ChainsResponse, type ChronicleReport } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

function asList(v: string[] | string | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p.map(String) : [String(v)];
  } catch {
    return [String(v)];
  }
}

function scoreColor(score?: number): string {
  const s = score ?? 0;
  if (s >= 75) return "var(--neon-red)";
  if (s >= 50) return "var(--neon-orange)";
  if (s >= 25) return "var(--neon-purple)";
  return "var(--neon-green)";
}

function ChainCard({ chain, delay }: { chain: Chain; delay: number }) {
  const [report, setReport] = useState<ChronicleReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const phases = asList(chain.kill_chain_phases);
  const color = scoreColor(chain.chain_score);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      setReport(await api.generateChronicle(chain.chain_id));
    } catch (e) {
      setErr(e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout") ? "Backend offline." : "Report generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card delay={delay}>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>{chain.chain_id}</div>
            {chain.actor_id && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>actor: {chain.actor_id}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color, textShadow: `0 0 14px ${color}66` }}>{chain.chain_score ?? 0}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>SCORE</span>
          </div>
        </div>

        {chain.attacker_intent && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{chain.attacker_intent}</p>
        )}

        {phases.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {phases.map((p, i) => (
              <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "3px 8px", borderRadius: 6, color, border: `1px solid ${color}44`, background: `${color}12` }}>
                {p}
              </span>
            ))}
          </div>
        )}

        {report && (
          <div style={{ borderTop: "1px solid rgba(0,212,255,0.12)", paddingTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55, color: "var(--text-primary)" }}>
            {report.executive_summary && <p>{report.executive_summary}</p>}
            {report.technical_details && <p style={{ color: "var(--text-muted)", marginTop: 6 }}>{report.technical_details}</p>}
          </div>
        )}
        {err && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#ff9bb3" }}>{err}</span>}

        <button type="button" className="sv-btn" disabled={busy} onClick={generate} style={{ marginTop: 2 }}>
          {busy ? "Generating…" : "📄 Generate CHRONICLE Report"}
        </button>
      </div>
    </Card>
  );
}

export default function MaceAttackChains() {
  const { data, state, refetch } = usePolling<ChainsResponse>(
    (signal) => api.getChains({ signal }),
    6000,
    (d) => !d.chains?.length,
  );

  if (state !== "data") {
    return (
      <Card tilt={false}>
        <StateMessage state={state} onRetry={refetch} emptyHint="No active attack chains. MACE populates this once correlated multi-stage activity is detected (try Demo Mode)." />
      </Card>
    );
  }

  return (
    <div className="sv-grid sv-grid-2">
      {(data?.chains ?? []).map((c, i) => <ChainCard key={c.chain_id} chain={c} delay={i * 0.05} />)}
    </div>
  );
}
