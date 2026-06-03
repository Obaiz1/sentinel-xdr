"use client";

import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { api, type Statistics } from "@/lib/apiClient";
import { usePolling } from "./usePolling";
import Card from "./Card";
import StateMessage from "./StateMessage";

const LEVEL_COLOR: Record<string, string> = {
  Critical: "#ff3366",
  High: "#ff9900",
  Medium: "#a855f7",
  Low: "#00ff88",
};
const SERIES = ["#00d4ff", "#00ff88", "#a855f7", "#ff9900", "#ff3366", "#ffd700"];

const tooltipStyle = {
  background: "#040a14",
  border: "1px solid rgba(0,212,255,0.4)",
  borderRadius: 8,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "#e2e8f0",
};
const tickStyle = { fontFamily: "var(--font-mono)", fontSize: 10, fill: "#4a6080" } as const;

function ChartCard({ title, accent, children, delay }: { title: string; accent: string; children: React.ReactNode; delay?: number }) {
  return (
    <Card tilt={false} delay={delay}>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <span className="sv-dot" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11.5, letterSpacing: "0.14em", color: "var(--text-primary)" }}>{title}</span>
        </div>
        <div style={{ width: "100%", height: 200 }}>{children}</div>
      </div>
    </Card>
  );
}

export default function ThreatIntelligenceDashboard() {
  const { data, state, refetch } = usePolling<Statistics>(
    (signal) => api.getStatistics({ signal }),
    5000,
    (d) =>
      !(d.threat_distribution?.length || d.protocol_breakdown?.length || d.threat_timeline?.length || d.top_attack_vectors?.length),
  );

  if (state !== "data") {
    return (
      <Card tilt={false}>
        <StateMessage
          state={state}
          onRetry={refetch}
          emptyHint="No threat data yet. Start Demo Mode for cloud preview, or run the local backend sniffer with Npcap for live capture."
        />
      </Card>
    );
  }

  const dist = data?.threat_distribution ?? [];
  const proto = data?.protocol_breakdown ?? [];
  const timeline = (data?.threat_timeline ?? []).map((t) => ({ t: t.minute_bucket?.slice(-5) ?? "", count: t.count }));
  const vectors = data?.top_attack_vectors ?? [];

  return (
    <div className="sv-grid sv-grid-2">
      <ChartCard title="THREAT DISTRIBUTION" accent="#ff3366" delay={0}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={dist} dataKey="count" nameKey="threat_level" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none">
              {dist.map((d, i) => (
                <Cell key={i} fill={LEVEL_COLOR[d.threat_level] ?? SERIES[i % SERIES.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="PROTOCOL BREAKDOWN" accent="#00d4ff" delay={0.05}>
        <ResponsiveContainer>
          <BarChart data={proto}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.08)" />
            <XAxis dataKey="protocol" tick={tickStyle} axisLine={{ stroke: "rgba(0,212,255,0.2)" }} tickLine={false} />
            <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,212,255,0.06)" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {proto.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="ALERT TIMELINE" accent="#a855f7" delay={0.1}>
        <ResponsiveContainer>
          <AreaChart data={timeline}>
            <defs>
              <linearGradient id="sv-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.08)" />
            <XAxis dataKey="t" tick={tickStyle} axisLine={{ stroke: "rgba(168,85,247,0.2)" }} tickLine={false} />
            <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(168,85,247,0.3)" }} />
            <Area type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} fill="url(#sv-area)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="TOP ATTACK VECTORS" accent="#ff9900" delay={0.15}>
        <ResponsiveContainer>
          <BarChart data={vectors} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,153,0,0.08)" horizontal={false} />
            <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="attack_vector" tick={tickStyle} axisLine={false} tickLine={false} width={96} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,153,0,0.06)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#ff9900" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
