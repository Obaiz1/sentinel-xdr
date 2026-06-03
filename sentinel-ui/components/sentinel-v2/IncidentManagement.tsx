"use client";

import { useMemo, useRef, useState } from "react";
import { api, ApiError, streamAriaChat, type Alert, type Chain, type AlertsResponse, type ChainsResponse, type ChronicleReport } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

/**
 * IncidentManagement — incident queue + War Room (screenshots 10/26/28/29).
 * Incidents are DERIVED from real data: each MACE chain (/chains) and each
 * critical/high alert (/alerts) becomes an incident with an ID synthesised from
 * its real chain_id / alert id (no fabricated tickets). MTTR/matrix from the
 * same telemetry. The War Room command console routes to the real ARIA backend
 * (/api/aria/chat) — no faked responses.
 */

interface Combined {
  chains: ChainsResponse;
  alerts: AlertsResponse;
}

type Severity = "Critical" | "High" | "Medium" | "Low";
const sevColor: Record<string, string> = { Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88" };

interface Incident {
  id: string;
  kind: "chain" | "alert";
  title: string;
  severity: Severity;
  time: string;
  chain?: Chain;
  alert?: Alert;
}

function chainSeverity(score?: number): Severity {
  const s = score ?? 0;
  if (s >= 75) return "Critical";
  if (s >= 50) return "High";
  if (s >= 25) return "Medium";
  return "Low";
}

function WarRoom({ incident }: { incident: Incident | null }) {
  const [report, setReport] = useState<ChronicleReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function genReport() {
    if (!incident?.chain) return;
    setBusy(true); setErr(null);
    try { setReport(await api.generateChronicle(incident.chain.chain_id)); }
    catch (e) { setErr(e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout") ? "Backend offline." : "Report generation failed."); }
    finally { setBusy(false); }
  }

  async function ask() {
    if (!q.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAsking(true); setAnswer(""); setErr(null);
    const ctx = incident ? `Incident ${incident.id} (${incident.title}, ${incident.severity}). ` : "";
    try {
      for await (const chunk of streamAriaChat(ctx + q, [], ctrl.signal)) setAnswer((a) => a + chunk);
    } catch (e) {
      setErr(e instanceof ApiError && e.kind === "offline" ? "ARIA backend offline." : "ARIA request failed.");
    } finally { setAsking(false); }
  }

  return (
    <Card tilt={false}>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, minHeight: 320 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="sv-dot sv-pulse-dot" style={{ background: "#ff3366", boxShadow: "0 0 8px #ff3366" }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: "0.16em" }}>WAR ROOM</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5, color: incident ? "#ff9900" : "#4a6080" }}>{incident ? "ENGAGED" : "STANDBY"}</span>
        </div>

        {!incident ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
            Select an incident from the queue<br />to open the operational view.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-primary)" }}>
              <div style={{ color: sevColor[incident.severity] }}>{incident.id} · {incident.severity.toUpperCase()}</div>
              <div style={{ color: "var(--text-muted)", marginTop: 4 }}>{incident.title}</div>
              {incident.alert && (
                <div style={{ color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
                  {incident.alert.src_ip} → {incident.alert.dst_ip} · {incident.alert.protocol}<br />
                  {incident.alert.mitre_technique && <>MITRE {incident.alert.mitre_technique}<br /></>}
                  {incident.alert.recommended_action && <span style={{ color: "#00ff88" }}>→ {incident.alert.recommended_action}</span>}
                </div>
              )}
              {incident.chain?.attacker_intent && <div style={{ color: "var(--text-muted)", marginTop: 6 }}>{incident.chain.attacker_intent}</div>}
            </div>

            {incident.chain && (
              <button type="button" className="sv-btn" disabled={busy} onClick={genReport}>{busy ? "Generating…" : "📄 Generate CHRONICLE Report"}</button>
            )}
            {report?.executive_summary && (
              <div style={{ borderTop: "1px solid rgba(0,212,255,0.12)", paddingTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55 }}>{report.executive_summary}</div>
            )}

            {answer && <div className="sv-bubble sv-bubble-ai" style={{ maxWidth: "100%" }}>{answer}</div>}
            {err && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#ff9bb3" }}>{err}</span>}

            <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
              <input
                value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
                placeholder="Ask ARIA about this incident…"
                style={{ flex: 1, minWidth: 0, height: 40, padding: "0 12px", borderRadius: 10, background: "rgba(2,8,18,0.8)", border: "1px solid rgba(0,212,255,0.25)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
              <button type="button" className="sv-btn" disabled={asking || !q.trim()} onClick={ask}>{asking ? "…" : "Send"}</button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export default function IncidentManagement() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, state, refetch } = usePolling<Combined>(
    async (signal) => {
      const [chains, alerts] = await Promise.all([api.getChains({ signal }), api.getAlerts({ limit: 50 })]);
      return { chains, alerts };
    },
    6000,
    (d) => !(d.chains.chains?.length || d.alerts.alerts?.length),
  );

  const model = useMemo(() => {
    if (!data) return null;
    const incidents: Incident[] = [];
    (data.chains.chains ?? []).forEach((c) => {
      incidents.push({
        id: `INC-C${String(c.chain_id).replace(/\D/g, "").slice(-4).padStart(4, "0")}`,
        kind: "chain", title: c.attacker_intent || `Attack chain ${c.chain_id}`,
        severity: chainSeverity(c.chain_score), time: c.last_seen ?? "", chain: c,
      });
    });
    (data.alerts.alerts ?? [])
      .filter((a) => a.threat_level === "Critical" || a.threat_level === "High")
      .slice(0, 12)
      .forEach((a) => {
        incidents.push({
          id: `INC-A${String(a.id).replace(/\D/g, "").slice(-4).padStart(4, "0")}`,
          kind: "alert", title: a.attack_vector || "Critical anomaly",
          severity: (a.threat_level as Severity) ?? "High", time: a.timestamp, alert: a,
        });
      });
    const order: Severity[] = ["Critical", "High", "Medium", "Low"];
    incidents.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

    // Matrix from recent alerts
    const matrix = (data.alerts.alerts ?? []).slice(0, 25).map((a) => a.threat_level ?? "Low");
    while (matrix.length < 25) matrix.push("");

    // MTTR from chains with first/last seen
    const spans = (data.chains.chains ?? [])
      .map((c) => (c.first_seen && c.last_seen ? new Date(c.last_seen).getTime() - new Date(c.first_seen).getTime() : null))
      .filter((x): x is number => x != null && x >= 0);
    const mttr = spans.length ? spans.reduce((s, x) => s + x, 0) / spans.length : null;

    return { incidents, matrix, mttr, active: incidents.length };
  }, [data]);

  if (state !== "data" || !model) {
    return (
      <Card tilt={false}>
        <StateMessage state={state} onRetry={refetch} emptyHint="No active incidents. MACE correlates chains and flags critical alerts once telemetry flows (try Demo Mode)." />
      </Card>
    );
  }

  const mttrLabel = model.mttr == null ? "—" : (() => {
    const sec = Math.floor(model.mttr / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  })();
  const selectedInc = model.incidents.find((i) => i.id === selected) ?? null;

  return (
    <div className="sv-split">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
        <div className="sv-grid sv-grid-2">
          <Card delay={0}>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 8 }}>MEAN TIME TO RESOLVE</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "#00d4ff", textShadow: "0 0 16px rgba(0,212,255,0.4)" }}>{mttrLabel}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", marginTop: 4 }}>avg chain dwell · derived from /chains</div>
            </div>
          </Card>
          <Card delay={0.05}>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 8 }}>ACTIVE THREAT MATRIX</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
                {model.matrix.map((lvl, i) => (
                  <div key={i} style={{ aspectRatio: "1", borderRadius: 4, background: lvl ? (sevColor[lvl] ?? "#1a2740") : "rgba(0,212,255,0.05)", boxShadow: lvl ? `0 0 8px ${sevColor[lvl]}66` : "none", opacity: lvl ? 0.85 : 0.4 }} />
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card tilt={false} delay={0.1}>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.16em" }}>CRITICAL TICKET QUEUE</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#ff9900" }}>{model.active} ACTIVE</span>
            </div>
            {model.incidents.length === 0 ? (
              <StateMessage state="empty" compact emptyHint="No open incidents." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {model.incidents.map((inc) => {
                  const color = sevColor[inc.severity];
                  const active = inc.id === selected;
                  const time = (() => { try { return inc.time ? new Date(inc.time).toLocaleTimeString() : ""; } catch { return inc.time; } })();
                  return (
                    <button key={inc.id} type="button" onClick={() => setSelected(inc.id)}
                      style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 11, alignItems: "center", textAlign: "left", padding: "11px 8px", minHeight: 48, cursor: "pointer", border: "none", borderBottom: "1px solid rgba(0,212,255,0.08)", borderLeft: `2px solid ${active ? color : "transparent"}`, background: active ? `${color}10` : "transparent" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color, border: `1px solid ${color}55`, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{inc.id}</span>
                      <span style={{ minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.title}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{time}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <WarRoom incident={selectedInc} />
    </div>
  );
}
