"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { backendGet, backendPost } from "@/lib/backend";
import Dropdown, { DropdownOption } from "@/components/Dropdown";

interface SystemStatus {
  sniffer?: { is_running?: boolean; interface?: string };
  demo?: { running?: boolean; generated?: number };
  llm_analyzer?: { analyzed_count?: number; error_count?: number };
  queues?: { packet_queue_size?: number; packet_queue_max?: number; llm_queue_size?: number; llm_queue_max?: number };
}

/** Turn raw scapy interface names into short, readable labels. */
function friendlyIface(raw: string): string {
  const npf = raw.match(/NPF_\{([0-9A-Fa-f-]+)\}/);
  if (npf) return `Adapter ${npf[1].slice(0, 8).toUpperCase()}`;
  // Strip \Device\ prefixes for anything else
  const tail = raw.replace(/^\\Device\\/i, "");
  return tail.length > 28 ? tail.slice(0, 27) + "…" : tail;
}

export default function ControlPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [toggling, setToggling] = useState(false);
  const [open, setOpen] = useState(false);
  const [backendUp, setBackendUp] = useState<boolean | null>(null); // null = unknown/loading
  const [error, setError] = useState<string | null>(null);
  const [demoToggling, setDemoToggling] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await backendGet<SystemStatus>("/status");
      setStatus(data);
      setBackendUp(true);
    } catch {
      setBackendUp(false);
      return; // backend down — skip interface fetch
    }
    try {
      const d = await backendGet<{ interfaces: string[]; current: string }>("/interfaces");
      const list = d.interfaces?.length ? d.interfaces : [];
      setInterfaces(list);
      setSelected((prev) => prev || d.current || list[0] || "");
    } catch {
      /* interfaces are optional */
    }
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, []);

  const toggleSniffer = async () => {
    if (!selected) { setError("Select a network interface first."); return; }
    setToggling(true);
    setError(null);
    try {
      await backendPost("/toggle-sniffing", { interface: selected });
      await fetchStatus();
    } catch (e) {
      setError(
        e instanceof Error && /500/.test(e.message)
          ? "Sniffer failed to start. Run the backend as Administrator with Npcap installed."
          : "Could not reach the sniffer backend."
      );
    }
    setToggling(false);
  };

  const demoOn = !!status?.demo?.running;
  const toggleDemo = async () => {
    setDemoToggling(true);
    setError(null);
    try {
      await backendPost(`/api/sniffer/demo/${demoOn ? "stop" : "start"}`, {});
      await fetchStatus();
    } catch {
      setError("Could not toggle demo mode — backend unreachable.");
    }
    setDemoToggling(false);
  };

  const snifferOn = !!status?.sniffer?.is_running;
  const pqSize = status?.queues?.packet_queue_size ?? 0;
  const pqMax = status?.queues?.packet_queue_max ?? 1;
  const lqSize = status?.queues?.llm_queue_size ?? 0;
  const lqMax = status?.queues?.llm_queue_max ?? 1;

  const options: DropdownOption[] = interfaces.map((iface) => ({
    value: iface,
    label: friendlyIface(iface),
    title: iface,
  }));

  // Derived sniffer state for the badge/label
  const snifferState: { label: string; color: string } = !backendUp
    ? { label: "BACKEND OFFLINE", color: "var(--neon-red)" }
    : toggling
    ? { label: "PROCESSING…", color: "var(--neon-orange)" }
    : snifferOn
    ? { label: "RUNNING", color: "var(--neon-green)" }
    : demoOn
    ? { label: "DEMO MODE", color: "var(--neon-purple)" }
    : { label: "IDLE", color: "var(--text-muted)" };

  return (
    <>
      {/* Gear FAB */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.08, rotate: 15 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: "fixed", bottom: 28, left: 20, zIndex: 1000,
          width: 52, height: 52, borderRadius: "50%",
          background: "rgba(0,12,30,0.9)", border: "1.5px solid rgba(0,212,255,0.4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, boxShadow: "0 0 20px rgba(0,212,255,0.2)"
        }}
      >
        ⚙️
      </motion.button>

      {/* Panel */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className="glass-card glow-blue"
          style={{
            position: "fixed", bottom: 92, left: 20, zIndex: 999,
            width: "min(300px, calc(100vw - 40px))",
            maxHeight: "calc(100dvh - 130px)", overflowY: "auto",
            padding: "20px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--neon-blue)", letterSpacing: "0.2em" }}>
              ⚙ CONTROL PANEL
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: snifferState.color, letterSpacing: "0.08em" }}>
              <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: snifferState.color, boxShadow: `0 0 8px ${snifferState.color}` }} />
              {snifferState.label}
            </span>
          </div>

          {/* Backend unavailable notice */}
          {backendUp === false && (
            <div style={{
              marginBottom: 14, padding: "10px 12px", borderRadius: 8,
              background: "rgba(255,51,102,0.08)", border: "1px solid rgba(255,51,102,0.35)",
              fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.6, color: "#ff9bb3"
            }}>
              Local sniffer agent not connected. Start the backend / local agent and set
              <span style={{ color: "var(--neon-blue)" }}> NEXT_PUBLIC_API_URL</span>.
            </div>
          )}

          {/* Interface selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
              NETWORK INTERFACE
            </div>
            <Dropdown
              options={options}
              value={selected}
              onChange={setSelected}
              placeholder={backendUp ? "Select interface…" : "Unavailable"}
              disabled={!backendUp || toggling}
            />
          </div>

          {/* Start/Stop */}
          <button
            type="button"
            onClick={toggleSniffer}
            disabled={toggling || !backendUp || !selected}
            style={{
              width: "100%", padding: "10px", borderRadius: 10,
              cursor: toggling || !backendUp || !selected ? "not-allowed" : "pointer",
              fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.1em",
              border: `1.5px solid ${snifferOn ? "rgba(255,51,102,0.6)" : "rgba(0,255,136,0.6)"}`,
              background: snifferOn ? "rgba(255,51,102,0.12)" : "rgba(0,255,136,0.1)",
              color: snifferOn ? "#ff3366" : "#00ff88",
              opacity: toggling || !backendUp || !selected ? 0.5 : 1, transition: "all 0.2s", marginBottom: 12
            }}
          >
            {toggling ? "⟳ PROCESSING…" : snifferOn ? "⏹ STOP SNIFFER" : "▶ START SNIFFER"}
          </button>

          {/* Demo Mode — safe synthetic events (no packet capture) */}
          <button
            type="button"
            onClick={toggleDemo}
            disabled={demoToggling || !backendUp || snifferOn}
            title="Generate synthetic events to preview the dashboard — no packet capture"
            style={{
              width: "100%", padding: "8px", borderRadius: 10,
              cursor: demoToggling || !backendUp || snifferOn ? "not-allowed" : "pointer",
              fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.1em",
              border: `1px solid ${demoOn ? "rgba(168,85,247,0.6)" : "rgba(168,85,247,0.35)"}`,
              background: demoOn ? "rgba(168,85,247,0.14)" : "rgba(168,85,247,0.06)",
              color: "var(--neon-purple)",
              opacity: demoToggling || !backendUp || snifferOn ? 0.5 : 1, transition: "all 0.2s", marginBottom: 12
            }}
          >
            {demoToggling ? "⟳ …" : demoOn ? `⏹ STOP DEMO (${status?.demo?.generated ?? 0})` : "✦ START DEMO MODE"}
          </button>

          {/* Inline error */}
          {error && (
            <div style={{
              marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 9.5, lineHeight: 1.5,
              color: "#ff9bb3"
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Queue meters */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                <span>PACKET QUEUE</span><span style={{ color: "var(--neon-blue)" }}>{pqSize}/{pqMax}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(0,212,255,0.08)" }}>
                <div style={{ width: `${Math.min(100, (pqSize / pqMax) * 100)}%`, height: "100%", borderRadius: 2, background: "var(--neon-blue)", transition: "width 0.5s" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                <span>LLM QUEUE</span><span style={{ color: "var(--neon-purple)" }}>{lqSize}/{lqMax}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(168,85,247,0.08)" }}>
                <div style={{ width: `${Math.min(100, (lqSize / lqMax) * 100)}%`, height: "100%", borderRadius: 2, background: "var(--neon-purple)", transition: "width 0.5s" }} />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
