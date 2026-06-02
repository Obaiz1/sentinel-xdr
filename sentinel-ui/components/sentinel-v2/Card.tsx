"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Card — glassmorphism panel with an optional pointer-driven 3D tilt.
 * Tilt is disabled for prefers-reduced-motion and on coarse pointers.
 */
export default function Card({
  children,
  tilt = true,
  className = "",
  style,
  delay = 0,
}: {
  children: ReactNode;
  tilt?: boolean;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const enableTilt = tilt && !reduce;

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!enableTilt || e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
  }
  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <motion.div
      ref={ref}
      className={`sv-card ${enableTilt ? "sv-tilt" : ""} ${className}`}
      style={style}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
