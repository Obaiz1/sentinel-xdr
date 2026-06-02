"use client";

import type { FetchState } from "./usePolling";

/**
 * StateMessage — renders loading / empty / error / offline states with a Retry
 * button. Never leaves a panel "awaiting data" forever.
 */
export default function StateMessage({
  state,
  onRetry,
  emptyHint = "No data yet. Start Demo Mode or the sniffer to populate this panel.",
  errorHint = "Something went wrong while loading.",
  compact = false,
}: {
  state: FetchState;
  onRetry?: () => void;
  emptyHint?: string;
  errorHint?: string;
  compact?: boolean;
}) {
  if (state === "data") return null;

  const cfg: Record<Exclude<FetchState, "data">, { icon: string; color: string; title: string; body: string; retry: boolean }> = {
    loading: { icon: "◌", color: "var(--neon-blue)", title: "Loading", body: "Fetching live telemetry…", retry: false },
    empty: { icon: "∅", color: "var(--neon-green)", title: "No data", body: emptyHint, retry: true },
    error: { icon: "⚠", color: "var(--neon-orange)", title: "Error", body: errorHint, retry: true },
    offline: {
      icon: "⛓",
      color: "var(--neon-red)",
      title: "Backend offline",
      body: "Can't reach the SENTINEL backend. Start it (uvicorn) and verify NEXT_PUBLIC_API_BASE_URL.",
      retry: true,
    },
  };

  const c = cfg[state];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textAlign: "center",
        padding: compact ? "18px 14px" : "34px 20px",
        color: "var(--text-muted)",
      }}
    >
      <span
        className={state === "loading" ? "sv-pulse-dot" : undefined}
        style={{ fontSize: 26, color: c.color, lineHeight: 1 }}
      >
        {c.icon}
      </span>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.2em", color: c.color }}>
        {c.title.toUpperCase()}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.5, maxWidth: 360 }}>{c.body}</span>
      {c.retry && onRetry && (
        <button type="button" onClick={onRetry} className="sv-btn" style={{ marginTop: 8 }}>
          ⟳ Retry
        </button>
      )}
    </div>
  );
}
