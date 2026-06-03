"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type SystemStatus, type InterfacesResponse } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import Dropdown, { type DropdownOption } from "@/components/Dropdown";

type SnifferUi = "idle" | "starting" | "running" | "stopping" | "error" | "offline" | "admin-required";

/** Friendly label for Windows raw interface names like \Device\NPF_{GUID}. */
function friendly(raw: string): string {
  const m = raw.match(/NPF_\{?([0-9a-fA-F]{8})/);
  if (m) return `Adapter ${m[1].toUpperCase()}`;
  if (raw.length > 28) return `${raw.slice(0, 26)}…`;
  return raw;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="cc-badge" style={{ color, border: `1px solid ${color}40`, background: `${color}12` }}>
      <span className="sv-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />{label}
    </span>
  );
}

function QueueMeter({ label, size, max }: { label: string; size?: number; max?: number }) {
  const pct = max && max > 0 ? Math.min(100, Math.round(((size ?? 0) / max) * 100)) : 0;
  const color = pct > 80 ? "var(--neon-red)" : pct > 50 ? "var(--neon-orange)" : "var(--neon-blue)";
  return (
    <div style={{ flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>
        <span>{label}</span><span style={{ color }}>{size ?? 0}/{max ?? 0}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "rgba(0,212,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, boxShadow: `0 0 10px ${color}`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function SnifferControlPanel() {
  // Status is polled through usePolling; the sniffer UI state is derived in render.
  const statusPoll = usePolling<SystemStatus>(() => api.getStatus(), 3000);
  const status = statusPoll.data;

  const [transition, setTransition] = useState<"starting" | "stopping" | null>(null);
  const [manualUi, setManualUi] = useState<SnifferUi | null>(null);
  const [message, setMessage] = useState<string>("");
  const [interfaces, setInterfaces] = useState<DropdownOption[]>([]);
  const [selected, setSelected] = useState("");
  const [demoOverride, setDemoOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const demoOn = demoOverride ?? !!status?.demo?.running;
  const offline = statusPoll.state === "offline" || statusPoll.state === "error";
  // Cloud detection: backend reports its platform in /status. Non-Windows ⇒ no Npcap/live capture.
  const platform = status?.system?.platform ?? "";
  const isCloud = !!platform && !/win/i.test(platform);
  const ui: SnifferUi = manualUi
    ? manualUi
    : offline
      ? "offline"
      : transition
        ? transition
        : status?.sniffer?.is_running
          ? "running"
          : "idle";

  // Load interfaces once.
  useEffect(() => {
    (async () => {
      try {
        const r: InterfacesResponse = await api.getInterfaces();
        const opts = (r.interfaces ?? []).map((raw) => ({ value: raw, label: friendly(raw), title: raw }));
        setInterfaces(opts);
        if (r.current) setSelected(r.current);
        else if (opts[0]) setSelected(opts[0].value);
      } catch {
        /* interface list optional; backend may be offline */
      }
    })();
  }, []);

  async function toggle(target: "start" | "stop") {
    setBusy(true);
    setManualUi(null);
    setTransition(target === "start" ? "starting" : "stopping");
    setMessage("");
    try {
      const r = await api.toggleSniffing(selected ? { interface: selected } : {});
      setMessage(r.message ?? "");
      setTransition(null);
      statusPoll.refetch(); // confirm running/idle from /status
    } catch (e) {
      setTransition(null);
      if (e instanceof ApiError) {
        if (e.kind === "offline" || e.kind === "timeout") setManualUi("offline");
        else if (e.status === 403 || e.status === 500) {
          setManualUi("admin-required");
          setMessage(
            "Sniffer needs admin/root permission on the backend agent machine (install Npcap and run the backend as Administrator).",
          );
        } else {
          setManualUi("error");
          setMessage(e.message);
        }
      } else {
        setManualUi("error");
        setMessage(String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleDemo() {
    setBusy(true);
    try {
      const r = demoOn ? await api.stopDemo() : await api.startDemo();
      setDemoOverride(!!r.demo?.running);
      statusPoll.refetch();
    } catch (e) {
      if (e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout")) setManualUi("offline");
    } finally {
      setBusy(false);
    }
  }

  const stateColor: Record<SnifferUi, string> = {
    idle: "var(--text-muted)",
    starting: "var(--neon-orange)",
    running: "var(--neon-green)",
    stopping: "var(--neon-orange)",
    error: "var(--neon-red)",
    offline: "var(--neon-red)",
    "admin-required": "var(--neon-orange)",
  };

  return (
    <Card tilt={false}>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.16em" }}>SNIFFER CONTROL</span>
          <span className="sv-pill" style={{ color: stateColor[ui], border: `1px solid ${stateColor[ui]}33`, background: `${stateColor[ui]}14` }}>
            <span className="sv-dot sv-pulse-dot" style={{ background: stateColor[ui], boxShadow: `0 0 8px ${stateColor[ui]}` }} />
            {ui.replace("-", " ").toUpperCase()}
          </span>
        </div>

        {/* Backend status badges */}
        <div className="cc-badge-row">
          <Badge label={offline ? "API OFFLINE" : "API ONLINE"} color={offline ? "var(--neon-red)" : "var(--neon-green)"} />
          <Badge label={status?.database?.connected ? "DB CONNECTED" : offline ? "DB —" : "DB ERROR"} color={status?.database?.connected ? "var(--neon-green)" : offline ? "var(--text-muted)" : "var(--neon-red)"} />
          <Badge label={status?.llm_analyzer?.is_running ? "LLM / ARIA ONLINE" : "LLM IDLE"} color={status?.llm_analyzer?.is_running ? "var(--neon-green)" : "var(--neon-orange)"} />
          <Badge label={status?.rag_engine?.initialized ? "RAG LOADED" : "RAG OFFLINE"} color={status?.rag_engine?.initialized ? "var(--neon-green)" : "var(--neon-orange)"} />
          <Badge
            label={isCloud ? "SNIFFER: LOCAL REQUIRED" : ui === "running" ? "SNIFFER RUNNING" : ui === "admin-required" ? "SNIFFER: ADMIN REQUIRED" : ui === "offline" ? "SNIFFER —" : "SNIFFER IDLE"}
            color={ui === "running" ? "var(--neon-green)" : (isCloud || ui === "admin-required") ? "var(--neon-orange)" : "var(--text-muted)"}
          />
          <Badge label={demoOn ? "DEMO TELEMETRY: ACTIVE" : "DEMO: OFF"} color={demoOn ? "var(--neon-purple)" : "var(--text-muted)"} />
        </div>

        {/* Cloud Preview banner */}
        {isCloud && (
          <div className="cc-banner" style={{ color: "var(--neon-purple)", border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.08)" }}>
            <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden>☁</span>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.14em", marginBottom: 4 }}>CLOUD PREVIEW MODE</div>
              <span style={{ color: "var(--text-muted)" }}>
                Live packet sniffing is not available in cloud/Vercel because Npcap/raw capture requires a local backend agent with Administrator permission. Use{" "}
                <b style={{ color: "var(--neon-green)" }}>Demo Mode</b> to generate safe telemetry for dashboard testing. ARIA, charts, alerts, chains and engine actions remain real backend calls.
              </span>
            </div>
          </div>
        )}

        <div>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
            CAPTURE INTERFACE
          </label>
          <div style={{ marginTop: 6 }}>
            <Dropdown
              options={interfaces}
              value={selected}
              onChange={setSelected}
              placeholder={ui === "offline" ? "Backend offline" : "Select interface…"}
              disabled={ui === "offline" || busy}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className={`sv-btn ${demoOn ? "sv-btn-green" : ""}`} disabled={busy || ui === "offline"} onClick={toggleDemo} style={{ flex: 2, minWidth: 150, borderColor: demoOn ? undefined : "rgba(168,85,247,0.5)", color: demoOn ? undefined : "var(--neon-purple)", background: demoOn ? undefined : "rgba(168,85,247,0.12)" }}>
            {demoOn ? "◉ Demo Running — Stop" : "▶ Start Demo Mode"}
          </button>
          <button type="button" className="sv-btn sv-btn-green" disabled={busy || ui === "running" || ui === "offline" || isCloud} title={isCloud ? "Available only on a local/backend agent with Npcap." : undefined} onClick={() => toggle("start")} style={{ flex: 1, minWidth: 110 }}>
            ▶ Start Sniffer
          </button>
          <button type="button" className="sv-btn sv-btn-red" disabled={busy || ui === "idle" || ui === "offline"} onClick={() => toggle("stop")} style={{ flex: 1, minWidth: 90 }}>
            ■ Stop
          </button>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <QueueMeter label="PACKET QUEUE" size={status?.queues?.packet_queue_size} max={status?.queues?.packet_queue_max} />
          <QueueMeter label="LLM QUEUE" size={status?.queues?.llm_queue_size} max={status?.queues?.llm_queue_max} />
        </div>

        {message && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              lineHeight: 1.5,
              color: ui === "admin-required" || ui === "error" || ui === "offline" ? "#ff9bb3" : "var(--text-muted)",
              borderTop: "1px solid rgba(0,212,255,0.1)",
              paddingTop: 10,
            }}
          >
            {message}
          </p>
        )}
        {ui === "offline" && !message && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#ff9bb3", lineHeight: 1.5 }}>
            Backend offline — start it (uvicorn) and set NEXT_PUBLIC_API_BASE_URL to control the sniffer.
          </p>
        )}
      </div>
    </Card>
  );
}
