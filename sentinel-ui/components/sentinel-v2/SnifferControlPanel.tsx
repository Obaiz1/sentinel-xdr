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
          <button type="button" className="sv-btn sv-btn-green" disabled={busy || ui === "running" || ui === "offline"} onClick={() => toggle("start")} style={{ flex: 1, minWidth: 120 }}>
            ▶ Start
          </button>
          <button type="button" className="sv-btn sv-btn-red" disabled={busy || ui === "idle" || ui === "offline"} onClick={() => toggle("stop")} style={{ flex: 1, minWidth: 120 }}>
            ■ Stop
          </button>
          <button type="button" className={`sv-btn ${demoOn ? "sv-btn-green" : "sv-btn-ghost"}`} disabled={busy || ui === "offline"} onClick={toggleDemo} style={{ flex: 1, minWidth: 120 }}>
            {demoOn ? "◉ Demo On" : "○ Demo Mode"}
          </button>
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
