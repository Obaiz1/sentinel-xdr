"use client";

type Variant = "loading" | "empty" | "error" | "offline";

const ICON: Record<Variant, string> = {
  loading: "⟳",
  empty: "○",
  error: "⚠",
  offline: "⛔",
};

const COLOR: Record<Variant, string> = {
  loading: "var(--neon-blue)",
  empty: "var(--text-muted)",
  error: "var(--neon-red)",
  offline: "var(--neon-orange)",
};

interface Props {
  variant: Variant;
  message: string;
  hint?: string;
  onRetry?: () => void;
  height?: number;
}

/** Consistent loading / empty / error / offline state with optional Retry. */
export default function StateMessage({ variant, message, hint, onRetry, height = 120 }: Props) {
  const color = COLOR[variant];
  return (
    <div
      style={{
        minHeight: height,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 8,
        textAlign: "center", padding: "1.5rem 1rem",
      }}
    >
      <span
        className={variant === "loading" ? "animate-radar" : ""}
        style={{ fontSize: 22, color, lineHeight: 1 }}
      >
        {ICON[variant]}
      </span>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: variant === "empty" ? "var(--text-muted)" : color }}>
        {message}
      </div>
      {hint && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", maxWidth: 360, lineHeight: 1.6 }}>
          {hint}
        </div>
      )}
      {onRetry && (variant === "error" || variant === "offline") && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 6, cursor: "pointer",
            padding: "5px 16px", borderRadius: 8,
            border: "1px solid rgba(0,212,255,0.4)", background: "rgba(0,212,255,0.08)",
            color: "var(--neon-blue)", fontFamily: "var(--font-mono)", fontSize: 11,
          }}
        >
          ⟳ Retry
        </button>
      )}
    </div>
  );
}
