"use client";

import { api, type SystemStatus } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

function Pill({ label, on, warn }: { label: string; on: boolean; warn?: boolean }) {
  const color = on ? "var(--neon-green)" : warn ? "var(--neon-orange)" : "var(--neon-red)";
  return (
    <span className="sv-pill" style={{ color, border: `1px solid ${color}33`, background: `${color}14` }}>
      <span className="sv-dot sv-pulse-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

function QueueMeter({ label, size, max }: { label: string; size?: number; max?: number }) {
  const pct = max && max > 0 ? Math.min(100, Math.round(((size ?? 0) / max) * 100)) : 0;
  const color = pct > 80 ? "var(--neon-red)" : pct > 50 ? "var(--neon-orange)" : "var(--neon-blue)";
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ color }}>{size ?? 0}/{max ?? 0}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "rgba(0,212,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, boxShadow: `0 0 10px ${color}`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function StatusPanel() {
  const { data, state, refetch } = usePolling<SystemStatus>((signal) => api.getStatus({ signal }), 3000);
  const offline = state === "offline" || state === "error";

  return (
    <Card>
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.16em", color: "var(--text-primary)" }}>
            BACKEND / API STATUS
          </span>
          {data && (
            <div style={{ display: "flex", gap: 18, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span>PKT <b style={{ color: "var(--neon-blue)" }}>{(data.sniffer?.packets_captured ?? 0).toLocaleString()}</b></span>
              <span>FLAGGED <b style={{ color: "var(--neon-orange)" }}>{(data.triage?.packets_flagged ?? 0).toLocaleString()}</b></span>
              <span>ANALYZED <b style={{ color: "var(--neon-green)" }}>{(data.llm_analyzer?.analyzed_count ?? 0).toLocaleString()}</b></span>
            </div>
          )}
        </div>

        {offline ? (
          <StateMessage state="offline" onRetry={refetch} compact />
        ) : state === "loading" && !data ? (
          <StateMessage state="loading" compact />
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <Pill label="API ONLINE" on />
              <Pill label={data?.sniffer?.is_running ? "SNIFFER ACTIVE" : "SNIFFER IDLE"} on={!!data?.sniffer?.is_running} warn={!data?.sniffer?.is_running} />
              <Pill label={data?.llm_analyzer?.is_running ? "LLM ACTIVE" : "LLM IDLE"} on={!!data?.llm_analyzer?.is_running} warn />
              <Pill label={data?.rag_engine?.initialized ? "RAG LOADED" : "RAG OFFLINE"} on={!!data?.rag_engine?.initialized} warn={!data?.rag_engine?.initialized} />
              <Pill label={data?.database?.connected ? "DB CONNECTED" : "DB ERROR"} on={!!data?.database?.connected} />
              {data?.demo?.running && <Pill label="DEMO MODE" on warn />}
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <QueueMeter label="PACKET QUEUE" size={data?.queues?.packet_queue_size} max={data?.queues?.packet_queue_max} />
              <QueueMeter label="LLM QUEUE" size={data?.queues?.llm_queue_size} max={data?.queues?.llm_queue_max} />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
