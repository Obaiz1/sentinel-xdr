"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";

// Reuse the existing SSR-safe 3D globe (three.js / react-globe.gl) — no new deps.
const HeroGlobe = dynamic(() => import("@/components/HeroGlobe"), { ssr: false });

export default function CommandHero() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "min(78dvh, 640px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(0,212,255,0.12)",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <HeroGlobe />
      </div>
      {/* radar sweep + radial fade */}
      <div
        className="sv-radar"
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(0,212,255,0.10) 30deg, transparent 60deg)",
          animation: "sv-radar 8s linear infinite",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 32%, #040a14 78%)", pointerEvents: "none" }} />

      <motion.div
        style={{ position: "relative", zIndex: 5, textAlign: "center", padding: "0 1rem" }}
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}
      >
        <h1 className="gradient-text text-glow-blue" style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(2.2rem, 8vw, 5.5rem)", letterSpacing: "-0.02em", lineHeight: 0.95 }}>
          SENTINEL XDR
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "clamp(9px, 2.2vw, 12px)", letterSpacing: "clamp(0.12em, 1vw, 0.36em)", color: "var(--text-muted)", textTransform: "uppercase", marginTop: 12 }}>
          Autonomous XDR · AI Threat Intelligence · Real-Time Defence
        </p>
        <motion.div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          {["MACE", "ARIA", "ADRS", "PHANTOM", "AEGIS", "CHRONICLE"].map((t) => (
            <span key={t} style={{ fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.2em", color: "var(--neon-blue)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 4, padding: "3px 10px", background: "rgba(0,212,255,0.06)" }}>
              {t}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
