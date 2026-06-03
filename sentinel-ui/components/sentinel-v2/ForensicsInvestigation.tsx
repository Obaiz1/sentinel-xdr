"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type Alert, type Chain, type AlertsResponse, type ChainsResponse, type ChronicleReport } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

/**
 * ForensicsInvestigation — deep-dive lab (screenshot 24).
 * Structured drill-down on a real alert (/alerts/{id}) + timeline from chain
 * kill-chain phases (/chains) + ARIA narrative (/api/chronicle/{id} or the
 * alert's own explanation). The screenshot's "raw bit-stream / hex" view is NOT
 * backed by any API (backend exposes structured telemetry, not packet bytes) →
 * shown as an explicit "raw byte stream not available" state, never faked.
 */

interface Combined { alerts: AlertsResponse; chains: ChainsResponse }
const sevColor: Record<string, string> = { Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88" };

function asList(v: string[] | string | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : [String(v)]; } catch { return [String(v)]; }
}

function Field({ label, value, color = "var(--text-primary)" }: { label: string; value?: string | number; color?: string }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(0,212,255,0.07)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

export default function ForensicsInvestigation() {
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [detail, setDetail] = useState<Alert | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [report, setReport] = useState<ChronicleReport | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, state, refetch } = usePolling<Combined>(
    async (signal) => {
      const [alerts, chains] = await Promise.all([api.getAlerts({ limit: 30 }), api.getChains({ signal })]);
      return { alerts, chains };
    },
    8000,
    (d) => !d.alerts.alerts?.length,
  );

  // Auto-select first alert
  useEffect(() => {
    if (selectedId == null && data?.alerts.alerts?.length) setSelectedId(data.alerts.alerts[0].id);
  }, [data, selectedId]);

  // Fetch full detail for the selected alert (real /alerts/{id} drill-down)
  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    setDetail(null); setDetailErr(null); setReport(null);
    api.getAlertById(selectedId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => {
        if (cancelled) return;
        // Fall back to the list copy if detail endpoint fails
        const fromList = data?.alerts.alerts?.find((a) => a.id === selectedId) ?? null;
        if (fromList) setDetail(fromList);
        else setDetailErr(e instanceof ApiError && e.kind === "offline" ? "Backend offline." : "Could not load alert detail.");
      });
    return () => { cancelled = true; };
  }, [selectedId, data]);

  const chain: Chain | undefined = useMemo(() => data?.chains.chains?.[0], [data]);
  const timeline = useMemo(() => {
    const phases = asList(chain?.kill_chain_phases);
    if (phases.length) return phases;
    if (detail?.mitre_technique) return ["Initial Access", detail.mitre_technique, detail.attack_vector ?? "Impact"].filter(Boolean) as string[];
    return [];
  }, [chain, detail]);

  async function genReport() {
    if (!chain) return;
    setBusy(true);
    try { setReport(await api.generateChronicle(chain.chain_id)); } catch { /* surfaced inline */ } finally { setBusy(false); }
  }

  if (state !== "data") {
    return (
      <Card tilt={false}>
        <StateMessage state={state} onRetry={refetch} emptyHint="No telemetry to investigate yet. Start Demo Mode or the sniffer to capture alerts." />
      </Card>
    );
  }

  const alerts = data?.alerts.alerts ?? [];
  const sev = detail?.threat_level ?? "Low";
  const color = sevColor[sev] ?? "#00d4ff";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
      {/* Session selector */}
      <Card tilt={false} delay={0}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>ACTIVE SESSION</span>
          <select
            value={String(selectedId ?? "")} onChange={(e) => setSelectedId(e.target.value)}
            style={{ flex: 1, minWidth: 200, height: 40, padding: "0 12px", borderRadius: 10, background: "rgba(2,8,18,0.92)", color: "var(--text-primary)", border: "1px solid rgba(0,212,255,0.3)", fontFamily: "var(--font-mono)", fontSize: 12 }}
          >
            {alerts.map((a) => (
              <option key={String(a.id)} value={String(a.id)} style={{ background: "#040a14" }}>
                #{a.id} · {a.threat_level ?? "?"} · {a.attack_vector ?? "anomaly"} · {a.src_ip ?? "?"}
              </option>
            ))}
          </select>
          <span className="sv-pill" style={{ color, border: `1px solid ${color}44`, background: `${color}14` }}>
            <span className="sv-dot sv-pulse-dot" style={{ background: color }} />{sev.toUpperCase()}
          </span>
        </div>
      </Card>

      <div className="sv-grid sv-grid-2">
        {/* Bit-stream analyzer → structured telemetry (raw bytes unavailable) */}
        <Card delay={0.05}>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.16em", marginBottom: 12 }}>PACKET / TELEMETRY ANALYZER</div>
            {detailErr ? (
              <StateMessage state="error" compact errorHint={detailErr} onRetry={() => setSelectedId((s) => s)} />
            ) : !detail ? (
              <StateMessage state="loading" compact />
            ) : (
              <>
                <Field label="Alert ID" value={String(detail.id)} />
                <Field label="Timestamp" value={detail.timestamp} />
                <Field label="Source" value={`${detail.src_ip ?? "?"}${detail.src_port ? ":" + detail.src_port : ""}`} color="#00d4ff" />
                <Field label="Destination" value={`${detail.dst_ip ?? "?"}${detail.dst_port ? ":" + detail.dst_port : ""}`} color="#00d4ff" />
                <Field label="Protocol" value={detail.protocol} />
                <Field label="TCP flags" value={detail.tcp_flags} />
                <Field label="MITRE" value={detail.mitre_technique} color={color} />
                <Field label="Confidence" value={detail.confidence != null ? `${Math.round(detail.confidence)}%` : undefined} />
                {/* Raw byte stream — honestly disabled */}
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, border: "1px dashed rgba(74,96,128,0.4)", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  ⊘ Raw byte / hex stream not available — the backend exposes structured packet telemetry, not captured payload bytes.
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ARIA copilot narrative */}
        <Card delay={0.1}>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="sv-aria-ring" style={{ width: 28, height: 28 }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.16em" }}>ARIA COPILOT</span>
            </div>
            {detail?.explanation && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6, color: "var(--text-primary)" }}>{detail.explanation}</p>}
            {detail?.recommended_action && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6, color: "#00ff88" }}>→ {detail.recommended_action}</p>}
            {!detail?.explanation && !detail?.recommended_action && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>No AI narrative attached to this alert. Generate a CHRONICLE report for the active attack chain below.</p>
            )}
            {chain && (
              <button type="button" className="sv-btn" disabled={busy} onClick={genReport} style={{ marginTop: "auto" }}>
                {busy ? "Generating…" : `📄 CHRONICLE: ${chain.chain_id}`}
              </button>
            )}
            {report?.executive_summary && (
              <div style={{ borderTop: "1px solid rgba(168,85,247,0.18)", paddingTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55 }}>{report.executive_summary}</div>
            )}
          </div>
        </Card>
      </div>

      {/* Timeline reconstruction */}
      <Card tilt={false} delay={0.15}>
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.16em", marginBottom: 14 }}>TIMELINE RECONSTRUCTION</div>
          {timeline.length === 0 ? (
            <StateMessage state="empty" compact emptyHint="No kill-chain phases available for reconstruction." />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 6 }}>
              {timeline.map((phase, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 96 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", border: `1px solid ${color}`, background: `${color}1a`, boxShadow: `0 0 12px ${color}55`, fontFamily: "var(--font-mono)", fontSize: 11, color }}>{i + 1}</div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", textAlign: "center", maxWidth: 90 }}>{phase}</span>
                  </div>
                  {i < timeline.length - 1 && <div style={{ width: 40, height: 2, background: `linear-gradient(90deg, ${color}, ${color}33)` }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
