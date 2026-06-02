"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import SentinelLogo from "./SentinelLogo";

export interface NavSection { id: string; label: string; color: string }

const NAV: NavSection[] = [
  { id: "overview", label: "Command Center", color: "#00d4ff" },
  { id: "control", label: "Control Panel", color: "#00ff88" },
  { id: "engines", label: "XDR Engine Suite", color: "#a855f7" },
  { id: "threat-intel", label: "Threat Intelligence", color: "#ff9900" },
  { id: "chains", label: "MACE Chains", color: "#ff9900" },
  { id: "alerts", label: "Live Alerts", color: "#ff3366" },
  { id: "settings", label: "Settings", color: "#4a6080" },
];

function NavList({ active, onPick }: { active: string; onPick: (id: string) => void }) {
  return (
    <>
      {NAV.map((s) => (
        <button key={s.id} type="button" className="sv-nav-item" data-active={active === s.id} onClick={() => onPick(s.id)}>
          <span className="sv-nav-dot" style={{ background: s.color, color: s.color }} />
          {s.label}
        </button>
      ))}
    </>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("overview");
  const [drawer, setDrawer] = useState(false);

  // Scroll-spy: highlight the section currently in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    NAV.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  function go(id: string) {
    setDrawer(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="sv-root">
      <div className="sv-bg" aria-hidden />
      <div className="sv-shell">
        <header className="sv-header">
          <button type="button" className="sv-nav-item sv-hamburger" aria-label="Open menu" onClick={() => setDrawer(true)} style={{ width: 40, height: 40, justifyContent: "center", padding: 0 }}>
            ☰
          </button>
          <Link href="/" style={{ textDecoration: "none" }}><SentinelLogo variant="full" /></Link>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span className="sv-pill sv-hide-mobile" style={{ color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.3)", background: "rgba(0,255,136,0.1)" }}>
              <span className="sv-dot sv-pulse-dot" style={{ background: "var(--neon-green)", boxShadow: "0 0 8px var(--neon-green)" }} />
              COMMAND CENTER
            </span>
            <Link href="/legacy" className="sv-btn sv-btn-ghost" style={{ textDecoration: "none", height: 36, minHeight: 36 }}>Legacy</Link>
          </div>
        </header>

        <div className="sv-body">
          <aside className="sv-sidebar">
            <NavList active={active} onPick={go} />
          </aside>
          <main className="sv-content">{children}</main>
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="sv-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.nav className="sv-drawer" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "tween", duration: 0.25 }}>
              <div style={{ marginBottom: 16 }}><SentinelLogo variant="full" /></div>
              <NavList active={active} onPick={go} />
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
