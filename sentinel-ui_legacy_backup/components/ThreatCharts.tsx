"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { backendGet } from "@/lib/backend";
import StateMessage from "@/components/StateMessage";

const COLORS: Record<string, string> = {
  Critical: "#ff3366", High: "#ff9900", Medium: "#a855f7", Low: "#00ff88"
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(4,10,20,0.95)", border: "1px solid rgba(0,212,255,0.3)",
      borderRadius: 8, padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 11
    }}>
      {label && <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || "var(--neon-blue)" }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

export default function ThreatCharts() {
  const [stats, setStats] = useState<any>(null);
  const [errored, setErrored] = useState(false);

  const poll = useCallback(async () => {
    try {
      const data = await backendGet<any>("/statistics");
      setStats(data);
      setErrored(false);
    } catch {
      setErrored(true);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  const threatDist = stats?.threat_distribution ?? [];
  const topVectors = stats?.top_attack_vectors ?? [];
  const timeline = stats?.threat_timeline ?? [];
  const protocols = stats?.protocol_breakdown ?? [];

  // Backend unreachable and nothing cached → single offline panel with retry
  if (errored && !stats) {
    return (
      <div className="glass-card" style={{ padding: "20px" }}>
        <StateMessage
          variant="offline"
          message="Threat intelligence backend unreachable"
          hint="Start the SENTINEL backend and set NEXT_PUBLIC_API_URL. Then run Demo Mode or the live sniffer to populate analytics."
          onRetry={poll}
          height={160}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 16 }}>

      {/* Threat Distribution Donut */}
      <motion.div className="glass-card" style={{ padding: "20px" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--neon-blue)", letterSpacing: "0.2em", marginBottom: 12 }}>
          THREAT DISTRIBUTION
        </div>
        {threatDist.length > 0 ? (
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={threatDist} dataKey="count" nameKey="threat_level" cx="50%" cy="50%" innerRadius={38} outerRadius={60} strokeWidth={0}>
                  {threatDist.map((d: any, i: number) => (
                    <Cell key={i} fill={COLORS[d.threat_level] || "#00d4ff"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {threatDist.map((d: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[d.threat_level] || "#00d4ff", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{d.threat_level}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: COLORS[d.threat_level] || "var(--neon-blue)", marginLeft: "auto" }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            Awaiting data…
          </div>
        )}
      </motion.div>

      {/* Protocol Breakdown */}
      <motion.div className="glass-card" style={{ padding: "20px" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--neon-green)", letterSpacing: "0.2em", marginBottom: 12 }}>
          PROTOCOL BREAKDOWN
        </div>
        {protocols.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={protocols} margin={{ left: -20, bottom: 0 }}>
              <XAxis dataKey="protocol" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="var(--neon-blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            Awaiting data…
          </div>
        )}
      </motion.div>

      {/* Threat Timeline */}
      <motion.div className="glass-card" style={{ padding: "20px", gridColumn: "1 / -1" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--neon-purple)", letterSpacing: "0.2em", marginBottom: 12 }}>
          ALERT TIMELINE (LAST 30 MIN)
        </div>
        {timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--neon-blue)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--neon-blue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="minute_bucket" tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" stroke="var(--neon-blue)" fill="url(#areaGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            Collecting timeline data…
          </div>
        )}
      </motion.div>

      {/* Top Attack Vectors */}
      <motion.div className="glass-card" style={{ padding: "20px", gridColumn: "1 / -1" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--neon-orange)", letterSpacing: "0.2em", marginBottom: 12 }}>
          TOP ATTACK VECTORS
        </div>
        {topVectors.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topVectors.slice(0, 6).map((v: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", flex: "0 1 200px", minWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.attack_vector || ""}>
                  {(v.attack_vector || "—").substring(0, 28)}
                </span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${(v.count / (topVectors[0]?.count || 1)) * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.07 }}
                    style={{ height: "100%", borderRadius: 2, background: `hsl(${200 - i * 25},100%,60%)` }}
                  />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-blue)", minWidth: 24, textAlign: "right" }}>
                  {v.count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            Awaiting threat data…
          </div>
        )}
      </motion.div>
    </div>
  );
}
