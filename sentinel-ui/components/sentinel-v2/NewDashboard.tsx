"use client";

import "./sentinel-v2.css";

import type { ReactNode } from "react";
import AppShell from "./AppShell";
import CommandHero from "./CommandHero";
import StatusPanel from "./StatusPanel";
import SnifferControlPanel from "./SnifferControlPanel";
import XDREngineSuite from "./XDREngineSuite";
import ThreatIntelligenceDashboard from "./ThreatIntelligenceDashboard";
import MaceAttackChains from "./MaceAttackChains";
import LiveAlertsStream from "./LiveAlertsStream";
import SettingsPanel from "./SettingsPanel";
import AriaCopilot from "./AriaCopilot";

function Section({ id, label, color, children }: { id: string; label: string; color: string; children: ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 76 }}>
      <div className="sv-section-head">
        <span className="sv-section-bar" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
        <span className="sv-section-label" style={{ color }}>{label}</span>
        <span className="sv-section-rule" style={{ background: `linear-gradient(90deg, ${color}44, transparent)` }} />
      </div>
      {children}
    </section>
  );
}

export default function NewDashboard() {
  return (
    <AppShell>
      {/* floating telemetry particles */}
      {[12, 34, 58, 76, 91].map((left, i) => (
        <span key={i} className="sv-stream-line" style={{ left: `${left}%`, height: 120, animationDuration: `${3 + i}s`, animationDelay: `${i * 0.6}s` }} aria-hidden />
      ))}

      <section id="overview" style={{ scrollMarginTop: 76, display: "flex", flexDirection: "column", gap: "var(--sv-gap)" }}>
        <CommandHero />
        <StatusPanel />
      </section>

      <Section id="control" label="Control Panel" color="#00ff88">
        <SnifferControlPanel />
      </Section>

      <Section id="engines" label="XDR Engine Suite" color="#a855f7">
        <XDREngineSuite />
      </Section>

      <Section id="threat-intel" label="Threat Intelligence" color="#ff9900">
        <ThreatIntelligenceDashboard />
      </Section>

      <Section id="chains" label="MACE — Attack Chain Analysis" color="#ff9900">
        <MaceAttackChains />
      </Section>

      <Section id="alerts" label="Live Alert Stream" color="#ff3366">
        <LiveAlertsStream />
      </Section>

      <Section id="settings" label="Settings / Configuration" color="#00d4ff">
        <SettingsPanel />
      </Section>

      <footer style={{ textAlign: "center", paddingTop: 24, borderTop: "1px solid rgba(0,212,255,0.08)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          SENTINEL XDR · Command Center · Autonomous Threat Intelligence
        </p>
      </footer>

      <AriaCopilot />
    </AppShell>
  );
}
