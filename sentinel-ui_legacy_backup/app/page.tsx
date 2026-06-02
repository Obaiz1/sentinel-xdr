"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import StatusBar from "@/components/StatusBar";
import AlertFeed from "@/components/AlertFeed";
import ThreatCharts from "@/components/ThreatCharts";
import ControlPanel from "@/components/ControlPanel";
import ChatPanel from "@/components/ChatPanel";
import XDRPanel from "@/components/XDRPanel";
import XDREngines from "@/components/XDREngines";

const HeroGlobe = dynamic(() => import("@/components/HeroGlobe"), { ssr: false });
const FloatingObjects = dynamic(() => import("@/components/FloatingObjects"), { ssr: false });
const DataStreams = dynamic(() => import("@/components/DataStreams"), { ssr: false });

/* ── Scrollytelling section wrapper ────────────────────────────────── */
function ScrollSection({
  id,
  label,
  labelColor = "var(--neon-blue)",
  children,
}: {
  id: string;
  label: string;
  labelColor?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.querySelectorAll(".reveal").forEach((r, i) => {
            setTimeout(() => r.classList.add("visible"), i * 80);
          });
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      id={id}
      ref={ref}
      style={{
        position: "relative",
        paddingTop: "clamp(2.5rem, 6vw, 5rem)",
        paddingBottom: "clamp(2.5rem, 6vw, 5rem)",
      }}
    >
      {/* Section accent line */}
      <div
        className="reveal reveal-on-scroll"
        style={{
          marginBottom: "2rem",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 32,
            height: 2,
            background: labelColor,
            boxShadow: `0 0 10px ${labelColor}`,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            color: labelColor,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, ${labelColor}44, transparent)`,
          }}
        />
      </div>
      <div className="reveal reveal-on-scroll">{children}</div>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  return (
    <>
      {/* Background layers */}
      <FloatingObjects />
      <DataStreams />

      <main
        className="hex-bg"
        style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(1rem, 4vw, 2rem) 5rem", position: "relative", zIndex: 2 }}
      >
        {/* ── HERO ──────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            height: "100dvh",
            minHeight: 560,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          {/* Full-screen globe behind */}
          <div style={{ position: "absolute", inset: 0 }}>
            <HeroGlobe />
          </div>

          {/* Radial fade over globe */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, transparent 30%, #040a14 75%)",
              pointerEvents: "none",
            }}
          />

          {/* Hero text */}
          <motion.div
            style={{ position: "relative", zIndex: 5, textAlign: "center" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "clamp(8px, 3vw, 20px)",
                marginBottom: 12,
              }}
            >
              <motion.div
                style={{
                  width: 2,
                  height: "clamp(32px, 9vw, 60px)",
                  background: "linear-gradient(180deg, transparent, #00d4ff, transparent)",
                }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <h1
                className="gradient-text text-glow-blue"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2.4rem, 9vw, 7rem)",
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  lineHeight: 0.9,
                }}
              >
                SENTINEL
              </h1>
              <motion.div
                style={{
                  width: 2,
                  height: "clamp(32px, 9vw, 60px)",
                  background: "linear-gradient(180deg, transparent, #00ff88, transparent)",
                }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </div>

            <motion.p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "clamp(9px, 2.2vw, 12px)",
                letterSpacing: "clamp(0.15em, 1.2vw, 0.4em)",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                padding: "0 1rem",
                maxWidth: "100%",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Autonomous XDR · AI Threat Intelligence · Real-Time Defence
            </motion.p>

            <motion.div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
            >
              {["MACE", "ARIA", "ADRS", "PHANTOM", "AEGIS", "CHRONICLE"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 8,
                    letterSpacing: "0.2em",
                    color: "var(--neon-blue)",
                    border: "1px solid rgba(0,212,255,0.3)",
                    borderRadius: 4,
                    padding: "3px 10px",
                    background: "rgba(0,212,255,0.06)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Scroll cue */}
          <motion.div
            style={{
              position: "absolute",
              bottom: 32,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.25em",
            }}
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <span>SCROLL</span>
            <span style={{ fontSize: 16, color: "var(--neon-blue)" }}>↓</span>
          </motion.div>
        </section>

        {/* ── STATUS BAR ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: "3rem" }}
        >
          <StatusBar />
        </motion.div>

        {/* ── XDR ENGINES ──────────────────────────────────── */}
        <ScrollSection id="xdr-engines" label="XDR Engine Suite" labelColor="var(--neon-blue)">
          <XDREngines />
        </ScrollSection>

        {/* ── LIVE THREAT INTELLIGENCE ─────────────────────── */}
        <ScrollSection id="threat-intel" label="Threat Intelligence" labelColor="var(--neon-purple)">
          <ThreatCharts />
        </ScrollSection>

        {/* ── ATTACK CHAINS ────────────────────────────────── */}
        <ScrollSection id="attack-chains" label="MACE — Attack Chain Analysis" labelColor="var(--neon-orange)">
          <XDRPanel />
        </ScrollSection>

        {/* ── LIVE ALERT STREAM ─────────────────────────────── */}
        <ScrollSection id="alerts" label="Live Alert Stream" labelColor="var(--neon-red)">
          <AlertFeed />
        </ScrollSection>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <footer
          style={{
            textAlign: "center",
            paddingTop: "3rem",
            borderTop: "1px solid rgba(0,212,255,0.08)",
            marginTop: "3rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            SENTINEL XDR · AI-Powered Threat Analysis · Autonomous Threat Intelligence Platform
          </p>
        </footer>
      </main>

      {/* Floating overlays */}
      <ControlPanel />
      <ChatPanel />
    </>
  );
}
