"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { backendGet, backendPost } from "@/lib/backend";
import StateMessage from "@/components/StateMessage";

interface Chain {
  chain_id: string;
  actor_id: string;
  chain_score: number;
  kill_chain_phases: string;
  first_seen: number;
  last_seen: number;
  status: string;
  mitre_techniques?: string;
}

interface Profile {
  actor_id: string;
  risk_score: number;
  total_chains: number;
  known_tactics: string;
  confidence_level: number;
  first_seen: number;
  last_seen: number;
}

function ScoreBar({ score, max = 100, color = "var(--neon-orange)" }: { score: number; max?: number; color?: string }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", flex: 1 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ height: "100%", borderRadius: 2, background: color, boxShadow: `0 0 6px ${color}` }}
      />
    </div>
  );
}

export default function XDRPanel() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [chronicle, setChronicle] = useState<Record<string, string>>({});
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  const poll = useCallback(async () => {
    try {
      const d = await backendGet<{ chains: Chain[] }>("/chains");
      setChains(d.chains || []);
      setErrored(false);
    } catch {
      setErrored(true);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 6000);
    return () => clearInterval(id);
  }, [poll]);

  const generateReport = async (chainId: string) => {
    setLoadingReport(chainId);
    try {
      const d = await backendPost<{ executive_summary: string }>(`/api/chronicle/${chainId}`, {});
      setChronicle(prev => ({ ...prev, [chainId]: d.executive_summary || "Report generated." }));
    } catch {}
    setLoadingReport(null);
  };

  const parseJson = (s: string) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

  const scoreColor = (score: number) => score >= 70 ? "#ff3366" : score >= 40 ? "#ffa500" : "#00d4ff";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── MACE Attack Chains ─────────────────────────── */}
      <div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--neon-orange)", letterSpacing: "0.2em", marginBottom: 12 }}>
          ◉ MACE — ACTIVE ATTACK CHAINS
        </h3>
        {errored ? (
          <div className="glass-card">
            <StateMessage
              variant="offline"
              message="MACE backend unreachable"
              hint="Start the SENTINEL backend and set NEXT_PUBLIC_API_URL to view correlated attack chains."
              onRetry={poll}
            />
          </div>
        ) : chains.length === 0 ? (
          <div className="glass-card">
            <StateMessage
              variant="empty"
              message="No active attack chains — system monitoring"
              hint="Run Demo Mode (⚙ Control Panel) or start the live sniffer; MACE builds multi-stage chains as events arrive."
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {chains.map((c, i) => {
              const phases: string[] = parseJson(c.kill_chain_phases);
              const color = scoreColor(c.chain_score);
              return (
                <motion.div
                  key={c.chain_id}
                  className="glass-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  style={{ padding: "14px 18px", borderColor: `${color}22` }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color }}>
                      {c.chain_id.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>
                      {c.actor_id}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
                      <ScoreBar score={c.chain_score} color={color} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, minWidth: 36 }}>
                        {c.chain_score.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Kill chain phases */}
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {phases.map((ph, pi) => (
                      <span key={pi} style={{
                        fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px", borderRadius: 4,
                        border: "1px solid rgba(255,153,0,0.35)", background: "rgba(255,153,0,0.08)", color: "#ffa500"
                      }}>{ph}</span>
                    ))}
                  </div>

                  {/* Chronicle button + report */}
                  <div style={{ marginTop: 10 }}>
                    {chronicle[c.chain_id] ? (
                      <div style={{
                        padding: "10px 14px", borderRadius: 8, background: "rgba(0,255,136,0.05)",
                        border: "1px solid rgba(0,255,136,0.15)", fontSize: 11, color: "#94a3b8", lineHeight: 1.6
                      }}>
                        <span style={{ color: "var(--neon-green)", fontFamily: "var(--font-mono)", fontSize: 10 }}>◉ CHRONICLE REPORT</span>
                        <p style={{ marginTop: 6 }}>{chronicle[c.chain_id]}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateReport(c.chain_id)}
                        disabled={loadingReport === c.chain_id}
                        style={{
                          padding: "5px 14px", borderRadius: 6, cursor: "pointer",
                          fontFamily: "var(--font-mono)", fontSize: 10,
                          border: "1px solid rgba(0,212,255,0.3)",
                          background: "rgba(0,212,255,0.06)", color: "var(--neon-blue)",
                          opacity: loadingReport === c.chain_id ? 0.5 : 1,
                          transition: "all 0.2s"
                        }}
                      >
                        {loadingReport === c.chain_id ? "⟳ Generating…" : "⊕ Generate CHRONICLE Report"}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
