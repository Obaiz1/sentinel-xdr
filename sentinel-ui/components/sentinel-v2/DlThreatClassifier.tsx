"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "./Card";
import {
  ApiError,
  dlApi,
  type DlFlowInput,
  type DlHealth,
  type DlPredictResponse,
} from "../../lib/apiClient";

/**
 * DlThreatClassifier — UI for the Deep Learning IDS model (Models V1/V2).
 *
 * It calls the SEPARATE DL FastAPI service (NEXT_PUBLIC_DL_API_URL), never the
 * XDR backend and never an LLM. When the DL API is not configured/unreachable it
 * shows a clear, honest state instead of faking a prediction.
 */

const PROTOCOLS = ["tcp", "udp", "icmp"];
const SERVICES = ["http", "ftp", "smtp", "ssh", "dns", "telnet", "private", "ecr_i", "other"];

type Preset = { name: string; color: string; flow: DlFlowInput };

const PRESETS: Preset[] = [
  {
    name: "Normal HTTP",
    color: "var(--neon-green)",
    flow: { duration: 30, protocol_type: "tcp", service: "http", src_bytes: 2500, dst_bytes: 8000, count: 8, srv_count: 7, same_srv_rate: 0.9 },
  },
  {
    name: "Port Scan (probe)",
    color: "var(--neon-orange)",
    flow: { duration: 2, protocol_type: "tcp", service: "private", src_bytes: 60, dst_bytes: 40, count: 200, srv_count: 20, same_srv_rate: 0.1 },
  },
  {
    name: "DoS Flood",
    color: "var(--neon-red)",
    flow: { duration: 1, protocol_type: "icmp", service: "ecr_i", src_bytes: 30, dst_bytes: 5, count: 480, srv_count: 470, same_srv_rate: 0.99 },
  },
  {
    name: "R2L (brute force)",
    color: "var(--neon-purple)",
    flow: { duration: 180, protocol_type: "tcp", service: "ftp", src_bytes: 350, dst_bytes: 900, count: 4, srv_count: 3, same_srv_rate: 0.55 },
  },
];

const NUMERIC_FIELDS: Array<{ key: keyof DlFlowInput; label: string; step?: number }> = [
  { key: "duration", label: "Duration (s)" },
  { key: "src_bytes", label: "Src bytes" },
  { key: "dst_bytes", label: "Dst bytes" },
  { key: "count", label: "Conn. count" },
  { key: "srv_count", label: "Service count" },
  { key: "same_srv_rate", label: "Same-srv rate (0–1)", step: 0.01 },
];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(8,18,32,0.7)",
  border: "1px solid rgba(0,212,255,0.25)",
  borderRadius: 6,
  color: "var(--text-primary)",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
};

export default function DlThreatClassifier() {
  const [flow, setFlow] = useState<DlFlowInput>(PRESETS[1].flow);
  const [result, setResult] = useState<DlPredictResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<DlHealth | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const mounted = useRef(true);

  const checkHealth = useCallback(async () => {
    if (!dlApi.configured) return;
    try {
      const h = await dlApi.health();
      if (mounted.current) {
        setHealth(h);
        setHealthErr(null);
      }
    } catch (e) {
      if (mounted.current) {
        setHealth(null);
        setHealthErr(e instanceof ApiError ? e.message : "health check failed");
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    checkHealth();
    return () => {
      mounted.current = false;
    };
  }, [checkHealth]);

  function setField(key: keyof DlFlowInput, value: string) {
    setFlow((f) => ({
      ...f,
      [key]: key === "protocol_type" || key === "service" ? value : Number(value),
    }));
  }

  async function classify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await dlApi.predict([flow]);
      if (mounted.current) setResult(res);
      checkHealth();
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof ApiError ? e.message : "Prediction failed");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  // ── Honest "not configured" state ─────────────────────────────────────
  if (!dlApi.configured) {
    return (
      <Card tilt={false}>
        <div style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>⛓</div>
          <h3 style={{ color: "var(--neon-orange)", margin: "0 0 8px" }}>
            DL model API not connected
          </h3>
          <p style={{ color: "var(--text-muted)", maxWidth: 520, margin: "0 auto", lineHeight: 1.6, fontSize: 13 }}>
            This page talks to the Deep Learning IDS service
            (<code>deployment/dl_api.py</code>), which runs separately from the XDR
            backend. Set <code>NEXT_PUBLIC_DL_API_URL</code> to its URL (e.g. your
            Hugging Face Space or <code>http://127.0.0.1:8000</code>) and reload.
            No prediction is shown until a real model service responds.
          </p>
        </div>
      </Card>
    );
  }

  const pred = result?.predictions[0];
  const isAttack = pred?.label === 1;
  const prob = pred ? Math.round(pred.attack_probability * 100) : 0;
  const accent = isAttack ? "var(--neon-red)" : "var(--neon-green)";

  return (
    <div className="cc-page" style={{ display: "grid", gap: 16 }}>
      {/* Service status banner */}
      <Card tilt={false}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", padding: "12px 16px" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>DL SERVICE</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>{dlApi.baseUrl}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center", fontSize: 12 }}>
            <span style={{ color: health?.model_loaded ? "var(--neon-green)" : "var(--neon-orange)" }}>
              ● {health?.model_loaded ? "model loaded" : healthErr ? "unreachable" : "checking…"}
            </span>
            {health?.model_path && <span style={{ color: "var(--text-muted)" }}>{health.model_path}</span>}
            {health?.threshold != null && <span style={{ color: "var(--text-muted)" }}>thr {health.threshold}</span>}
          </span>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }} className="dl-grid">
        {/* Input form */}
        <Card tilt={false}>
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 4px", color: "var(--neon-blue)" }}>Network flow features</h3>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-muted)" }}>
              Enter an NSL-KDD-style flow, or load a preset, then classify.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="sv-btn-ghost"
                  onClick={() => { setFlow(p.flow); setResult(null); setError(null); }}
                  style={{ borderColor: p.color, color: p.color, fontSize: 12, padding: "5px 10px" }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="dl-proto">Protocol</label>
                <select id="dl-proto" style={inputStyle} value={flow.protocol_type} onChange={(e) => setField("protocol_type", e.target.value)}>
                  {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="dl-svc">Service</label>
                <select id="dl-svc" style={inputStyle} value={flow.service} onChange={(e) => setField("service", e.target.value)}>
                  {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {NUMERIC_FIELDS.map((f) => (
                <div key={f.key}>
                  <label style={labelStyle} htmlFor={`dl-${f.key}`}>{f.label}</label>
                  <input
                    id={`dl-${f.key}`}
                    type="number"
                    step={f.step ?? 1}
                    style={inputStyle}
                    value={String(flow[f.key])}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              className="sv-btn"
              onClick={classify}
              disabled={busy}
              style={{ marginTop: 16, width: "100%", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Classifying…" : "Classify flow"}
            </button>
            {error && (
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--neon-red)" }}>⚠ {error}</p>
            )}
          </div>
        </Card>

        {/* Result */}
        <Card tilt={false}>
          <div style={{ padding: 16, minHeight: 260, display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 14px", color: "var(--neon-blue)" }}>Classification result</h3>
            {!pred && !error && (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Submit a flow to see the model&apos;s verdict.
              </div>
            )}
            {error && !pred && (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--neon-orange)", fontSize: 13 }}>
                Could not reach the DL service. Verify it is running and reachable.
              </div>
            )}
            {pred && (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: 1 }}>VERDICT</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: accent, textShadow: `0 0 14px ${accent}` }}>
                    {isAttack ? "⚠ ATTACK" : "✓ NORMAL"}
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                    <span>Attack probability</span><span style={{ color: accent }}>{prob}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ width: `${prob}%`, height: "100%", background: accent, boxShadow: `0 0 10px ${accent}`, transition: "width .4s" }} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                  <span>Confidence</span><span style={{ color: "var(--text-primary)" }}>{Math.round((pred.confidence) * 100)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                  <span>Model</span><span style={{ color: "var(--text-primary)" }}>{result?.model_path}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  Prediction from a trained Keras ANN (binary intrusion detection).
                  This is a real model inference, served by the DL FastAPI service.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
