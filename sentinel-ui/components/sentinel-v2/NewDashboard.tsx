"use client";

import "./sentinel-v2.css";

import type { ReactNode } from "react";
import AppShell, { type ViewDef } from "./AppShell";
import CommandCenter from "./CommandCenter";
import SnifferControlPanel from "./SnifferControlPanel";
import XDREngineSuite from "./XDREngineSuite";
import ThreatIntelligenceDashboard from "./ThreatIntelligenceDashboard";
import MaceAttackChains from "./MaceAttackChains";
import LiveAlertsStream from "./LiveAlertsStream";
import SettingsPanel from "./SettingsPanel";
import { IconCommand, IconControl, IconAria, IconEngine, IconThreat, IconChain, IconAlerts, IconSettings } from "./Icons";

/** Page wrapper giving non-Command views a titled header, matching the screenshots. */
function Page({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div className="cc-page">
      <div className="cc-page-head">
        <span style={{ width: 30, height: 2, background: color, boxShadow: `0 0 10px ${color}` }} />
        <span className="cc-page-title" style={{ color }}>{title}</span>
        <span className="cc-page-rule" />
      </div>
      {children}
    </div>
  );
}

const VIEWS: ViewDef[] = [
  { id: "command", label: "Command Center", color: "#00d4ff", Icon: IconCommand, node: <CommandCenter /> },
  { id: "control", label: "Control Panel", color: "#00ff88", Icon: IconControl, node: <Page title="Control Panel" color="#00ff88"><SnifferControlPanel /></Page> },
  { id: "aria", label: "ARIA Copilot", color: "#a855f7", Icon: IconAria, aria: true, badge: "AI" },
  { id: "engines", label: "XDR Engines", color: "#a855f7", Icon: IconEngine, node: <Page title="XDR Engine Suite" color="#a855f7"><XDREngineSuite /></Page> },
  { id: "intel", label: "Threat Intelligence", color: "#ff9900", Icon: IconThreat, node: <Page title="Threat Intelligence" color="#ff9900"><ThreatIntelligenceDashboard /></Page> },
  { id: "chains", label: "MACE Chains", color: "#ff9900", Icon: IconChain, node: <Page title="MACE — Attack Chain Analysis" color="#ff9900"><MaceAttackChains /></Page> },
  { id: "alerts", label: "Live Alerts", color: "#ff3366", Icon: IconAlerts, dot: "#ff3366", node: <Page title="Live Alert Stream" color="#ff3366"><LiveAlertsStream /></Page> },
  { id: "settings", label: "Settings", color: "#4a6080", Icon: IconSettings, node: <Page title="Settings / Configuration" color="#00d4ff"><SettingsPanel /></Page> },
];

export default function NewDashboard() {
  return <AppShell views={VIEWS} />;
}
