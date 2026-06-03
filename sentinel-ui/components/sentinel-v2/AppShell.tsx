"use client";

import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import SentinelLogo from "./SentinelLogo";
import AriaPanel from "./AriaPanel";
import { NavContext, type NavApi } from "./NavContext";
import { IconAria, IconBell, IconLegacy, IconMenu, IconScan, IconSearch, IconSettings, IconSupport, IconDoc, IconUser } from "./Icons";

export interface ViewDef {
  id: string;
  label: string;
  color: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  node?: ReactNode;
  badge?: string;
  dot?: string;
  aria?: boolean;
}

export default function AppShell({ views }: { views: ViewDef[] }) {
  const firstView = views.find((v) => !v.aria)?.id ?? views[0].id;
  const [view, setView] = useState(firstView);
  const [drawer, setDrawer] = useState(false);
  const [aria, setAria] = useState(false);
  const [alertFilter, setAlertFilterState] = useState<string | null>(null);
  const [sync, setSync] = useState("");

  useEffect(() => {
    const tick = () => setSync(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function scrollMainTop() {
    document.querySelector(".cc-main")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const nav: NavApi = {
    navigate: (id) => { setDrawer(false); setView(id); scrollMainTop(); },
    openAria: () => setAria(true),
    alertFilter,
    setAlertFilter: setAlertFilterState,
  };

  function pick(v: ViewDef) {
    setDrawer(false);
    if (v.aria) { setAria(true); return; }
    setView(v.id);
    scrollMainTop();
  }

  const active = views.find((v) => v.id === view && !v.aria) ?? views.find((v) => !v.aria) ?? views[0];

  const renderNav = (inDrawer = false): ReactNode => (
    <>
      {views.map((v) => (
        <button key={v.id} type="button" className="cc-nav" data-active={!v.aria && view === v.id} onClick={() => pick(v)}>
          <v.Icon style={{ color: (!v.aria && view === v.id) ? v.color : undefined }} />
          {v.label}
          {v.badge && <span className="cc-nav-badge">{v.badge}</span>}
          {v.dot && <span className="cc-nav-dot" style={{ background: v.dot, boxShadow: `0 0 8px ${v.dot}` }} />}
        </button>
      ))}
      {!inDrawer && <div className="cc-side-spacer" />}
      <button type="button" className="cc-scan" onClick={() => { setView("control"); scrollMainTop(); }}>
        <IconScan style={{ width: 16, height: 16 }} /> INITIATE SCAN
      </button>
      <div className="cc-side-foot">
        <a className="cc-side-link" href="https://github.com" target="_blank" rel="noreferrer noopener"><IconSupport /> Support</a>
        <a className="cc-side-link" href="https://github.com" target="_blank" rel="noreferrer noopener"><IconDoc /> Documentation</a>
        <Link className="cc-side-link" href="/legacy" style={{ color: "var(--text-muted)", opacity: 0.7 }}><IconLegacy /> Legacy UI</Link>
      </div>
    </>
  );

  return (
    <NavContext.Provider value={nav}>
      <div className="cc-root">
        <div className="cc-bg" aria-hidden />

        <header className="cc-header">
          <button type="button" className="cc-icon-btn cc-hamburger" aria-label="Open menu" onClick={() => setDrawer(true)}><IconMenu /></button>
          <Link href="/" style={{ textDecoration: "none" }}><SentinelLogo variant="full" /></Link>

          <div className="sv-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, padding: "0 12px", height: 34, borderRadius: 9, border: "1px solid rgba(0,212,255,0.14)", background: "rgba(0,212,255,0.04)", color: "var(--text-muted)", minWidth: 180 }}>
            <IconSearch style={{ width: 14, height: 14 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Query system…</span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="cc-status-pill"><span className="sv-dot sv-pulse-dot" style={{ background: "var(--neon-green)", boxShadow: "0 0 8px var(--neon-green)" }} />SYSTEM LIVE</span>
            {sync && <span className="cc-head-meta">Last sync: {sync}</span>}
            <button type="button" className="cc-icon-btn sv-hide-mobile" aria-label="Notifications"><IconBell /></button>
            <button type="button" className="cc-icon-btn sv-hide-mobile" aria-label="Settings" onClick={() => setView("settings")}><IconSettings /></button>
            <button type="button" className="cc-icon-btn" aria-label="Account"><IconUser /></button>
          </div>
        </header>

        <div className="cc-body">
          <aside className="cc-side">{renderNav()}</aside>
          <main className="cc-main">{active.node}</main>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawer && (
            <>
              <motion.div className="sv-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
              <motion.nav className="sv-drawer" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "tween", duration: 0.25 }} style={{ width: "min(86vw, 300px)" }}>
                <div style={{ marginBottom: 14 }}><SentinelLogo variant="full" /></div>
                {renderNav(true)}
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        {/* ARIA floating orb — always present, never reserves layout space */}
        <button type="button" className="sv-aria-fab" aria-label={aria ? "Close ARIA copilot" : "Open ARIA copilot"} onClick={() => setAria((o) => !o)}>
          <span className="sv-aria-ring"><IconAria style={{ width: 18, height: 18, color: "var(--neon-purple)" }} /></span>
          <span className="cc-fab-dot" />
        </button>
        <AnimatePresence>
          {aria && (
            <>
              <motion.div className="sv-drawer-backdrop cc-aria-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAria(false)} />
              <motion.div className="sv-aria-panel" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }} transition={{ duration: 0.22 }}>
                <AriaPanel onClose={() => setAria(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </NavContext.Provider>
  );
}
