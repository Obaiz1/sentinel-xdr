"use client";

/**
 * SentinelLogo — SVG cyber-shield + "S" monogram with neon glow, circuit grid,
 * an AI neural core and a green system-pulse dot. Self-contained (no assets).
 *
 * variant:
 *   "full"    → icon + "SENTINEL XDR" wordmark (header)
 *   "compact" → icon only (sidebar / favicon-style)
 */
export default function SentinelLogo({
  variant = "full",
  size = 34,
}: {
  variant?: "full" | "compact";
  size?: number;
}) {
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="SENTINEL XDR logo"
      style={{ flexShrink: 0, filter: "drop-shadow(0 0 6px rgba(0,212,255,0.55))" }}
    >
      <defs>
        <linearGradient id="sv-shield" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d4ff" />
          <stop offset="1" stopColor="#00ff88" />
        </linearGradient>
        <radialGradient id="sv-core" cx="0.5" cy="0.45" r="0.55">
          <stop stopColor="#c79bff" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0.15" />
        </radialGradient>
      </defs>

      {/* Shield body */}
      <path
        d="M32 3 L57 13 V31 C57 46 46 56 32 61 C18 56 7 46 7 31 V13 Z"
        fill="rgba(0,212,255,0.06)"
        stroke="url(#sv-shield)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Circuit grid lines */}
      <g stroke="rgba(0,212,255,0.30)" strokeWidth="1">
        <path d="M7 24 H20 M44 24 H57 M7 40 H18 M46 40 H57" />
        <circle cx="20" cy="24" r="1.6" fill="#00d4ff" stroke="none" />
        <circle cx="44" cy="24" r="1.6" fill="#00d4ff" stroke="none" />
      </g>
      {/* Futuristic S monogram */}
      <path
        d="M40 21 C40 18 35 17 31 17 C26 17 23 19 23 23 C23 31 41 27 41 36 C41 41 36 44 31 44 C26 44 22 42 22 39"
        fill="none"
        stroke="url(#sv-shield)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* AI neural core (eye) */}
      <circle cx="32" cy="30" r="6" fill="url(#sv-core)" />
      <circle cx="32" cy="30" r="2.4" fill="#a855f7" />
      {/* Green system-pulse dot */}
      <circle cx="32" cy="55" r="2.4" fill="#00ff88">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );

  if (variant === "compact") return icon;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {icon}
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          className="gradient-text"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, letterSpacing: "0.12em" }}
        >
          SENTINEL
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.42em",
            color: "var(--neon-green)",
            marginTop: 2,
          }}
        >
          XDR
        </span>
      </span>
    </span>
  );
}
