"use client";

import Link from "next/link";
import { API_BASE_URL } from "@/lib/apiClient";
import Card from "./Card";

function Row({ label, value, valueColor = "var(--neon-blue)" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(0,212,255,0.08)", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: valueColor, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

export default function SettingsPanel() {
  const uiVersion = process.env.NEXT_PUBLIC_UI_VERSION ?? "legacy";

  return (
    <Card tilt={false}>
      <div style={{ padding: "18px 20px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.16em", marginBottom: 14 }}>SETTINGS / CONFIGURATION</div>

        <Row label="Active UI" value={uiVersion === "new" ? "New (Stitch)" : "Legacy"} valueColor={uiVersion === "new" ? "var(--neon-green)" : "var(--neon-orange)"} />
        <Row label="Backend URL" value={API_BASE_URL} />
        <Row label="Legacy UI" value="Available" valueColor="var(--neon-green)" />
        <Row label="UI switch" value="NEXT_PUBLIC_UI_VERSION=legacy|new" valueColor="var(--text-muted)" />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <Link href="/legacy" className="sv-btn sv-btn-ghost" style={{ textDecoration: "none", flex: 1, minWidth: 150 }}>
            ↩ Open Legacy UI
          </Link>
          <Link href="/new" className="sv-btn" style={{ textDecoration: "none", flex: 1, minWidth: 150 }}>
            ⚡ Preview New UI
          </Link>
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 14 }}>
          The root route &quot;/&quot; renders the UI chosen by NEXT_PUBLIC_UI_VERSION (default legacy). Flip it to
          &quot;new&quot; and redeploy to make the Stitch UI the default. /legacy and /new always force their UI.
        </p>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(0,212,255,0.1)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.14em", color: "var(--neon-orange)", marginBottom: 8 }}>LIVE SNIFFER SETUP</div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Cloud/Vercel cannot sniff packets directly. For live capture, run the Python backend/agent on the target
            network machine with <b style={{ color: "var(--text-primary)" }}>Npcap installed</b> and{" "}
            <b style={{ color: "var(--text-primary)" }}>Administrator permission</b>, then point the frontend at it via{" "}
            <b style={{ color: "var(--neon-blue)" }}>NEXT_PUBLIC_API_BASE_URL</b>. For cloud demos, use Demo Mode.
          </p>
        </div>
        <Row label="Live capture env" value="NEXT_PUBLIC_API_BASE_URL" valueColor="var(--neon-blue)" />
      </div>
    </Card>
  );
}
