"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "./Card";

/**
 * LiveDetector — shows the live feed from deployment/live_detector.py (run with
 * --serve). It polls the detector's /api/flows endpoint and renders real-time
 * classifications of captured traffic + recommended actions. When the detector
 * is not running it shows clear start instructions (never fakes a feed).
 */

const DETECTOR_URL = (process.env.NEXT_PUBLIC_DETECTOR_URL ?? "http://127.0.0.1:8050").replace(/\/$/, "");

interface Flow {
  time: string;
  src_ip: string;
  dst_ip: string;
  dst_port: number | null;
  service: string;
  protocol_type: string;
  count: number;
  verdict: "ATTACK" | "NORMAL";
  attack_probability: number;
  severity: string;
  category: string;
  action: string;
}
interface Summary {
  uptime_sec: number;
  total: number;
  attacks: number;
  normal: number;
  by_category: Record<string, number>;
  top_sources: Record<string, number>;
}

const sevColor: Record<string, string> = {
  HIGH: "var(--neon-red)",
  MEDIUM: "var(--neon-orange)",
  OK: "var(--text-muted)",
};

export default function LiveDetector() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${DETECTOR_URL}/api/flows`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (mounted.current) {
        setFlows(data.flows ?? []);
        setSummary(data.summary ?? null);
        setOnline(true);
      }
    } catch {
      if (mounted.current) setOnline(false);
    } finally {
      if (mounted.current) timer.current = setTimeout(poll, 1500);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    poll();
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  // ── detector not running ──────────────────────────────────────────────
  if (online === false) {
    return (
      <Card tilt={false}>
        <div style={{ padding: 26, maxWidth: 680, margin: "0 auto" }}>
          <h3 style={{ color: "var(--neon-orange)", margin: "0 0 8px" }}>
            ⛓ Live detector not running
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
            This panel streams real captured traffic classified by the model. Start
            the detector in an <b>Administrator</b> terminal (Npcap required), then
            this page lights up automatically:
          </p>
          <pre style={{ background: "rgba(8,18,32,0.8)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "var(--neon-green)", overflowX: "auto" }}>
{`.\\venv\\Scripts\\python.exe deployment\\live_detector.py \\
   --api http://127.0.0.1:8001 --serve \\
   --bpf "ip and not net 224.0.0.0/4"`}
          </pre>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Then browse the web or run <code>ping</code> / <code>nmap</code> on an
            authorised host and watch flows appear here as NORMAL / ATTACK with a
            recommended action for each.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* summary cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { k: "Flows", v: summary?.total ?? 0, c: "var(--neon-blue)" },
          { k: "Attacks", v: summary?.attacks ?? 0, c: "var(--neon-red)" },
          { k: "Normal", v: summary?.normal ?? 0, c: "var(--neon-green)" },
          { k: "Uptime", v: `${summary?.uptime_sec ?? 0}s`, c: "var(--text-primary)" },
        ].map((c) => (
          <Card key={c.k} tilt={false}>
            <div style={{ padding: "12px 20px", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{c.k}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.c }}>{c.v}</div>
            </div>
          </Card>
        ))}
        <Card tilt={false}>
          <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", height: "100%" }}>
            <a href={`${DETECTOR_URL}/report`} target="_blank" rel="noopener noreferrer"
               style={{ color: "var(--neon-blue)", fontSize: 13, textDecoration: "none" }}>
              📄 Open incident report ↗
            </a>
          </div>
        </Card>
      </div>

      {/* live feed */}
      <Card tilt={false}>
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 4px", color: "var(--neon-blue)" }}>Live classified traffic</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
            Real captured flows → trained model → verdict + recommended action. Updates every 1.5s.
          </p>
          <div style={{ overflowX: "auto", maxHeight: 520 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "var(--bg-0, #070d16)" }}>
                  {["Time", "Source → Dest:Port", "Service", "Proto", "Cnt", "Verdict", "P(attack)", "Sev", "Recommended action"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", textTransform: "uppercase", fontSize: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flows.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                    Waiting for traffic… generate some (browse / ping) to see flows.
                  </td></tr>
                )}
                {flows.map((f, i) => {
                  const pct = Math.round(f.attack_probability * 100);
                  const atk = f.verdict === "ATTACK";
                  const vColor = atk ? "var(--neon-red)" : "var(--neon-green)";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "6px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{f.time}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{f.src_ip} → {f.dst_ip}:{f.dst_port ?? "-"}</td>
                      <td style={{ padding: "6px 8px" }}>{f.service}</td>
                      <td style={{ padding: "6px 8px" }}>{f.protocol_type}</td>
                      <td style={{ padding: "6px 8px" }}>{f.count}</td>
                      <td style={{ padding: "6px 8px", color: vColor, fontWeight: 700 }}>{f.verdict}</td>
                      <td style={{ padding: "6px 8px", minWidth: 70 }}>
                        {pct}%
                        <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.08)", marginTop: 2 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: vColor }} />
                        </div>
                      </td>
                      <td style={{ padding: "6px 8px", color: sevColor[f.severity] ?? "var(--text-muted)" }}>{f.severity}</td>
                      <td style={{ padding: "6px 8px", color: "var(--neon-orange)", whiteSpace: "normal", minWidth: 220 }}>
                        {atk ? f.action : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
