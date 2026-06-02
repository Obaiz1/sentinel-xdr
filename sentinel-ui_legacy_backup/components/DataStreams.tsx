"use client";
import { useEffect, useRef } from "react";

const LINES = 6;

export default function DataStreams() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const lines: HTMLDivElement[] = [];

    for (let i = 0; i < LINES; i++) {
      const div = document.createElement("div");
      div.className = "data-stream-line";
      const x = Math.random() * window.innerWidth;
      div.style.left = `${x}px`;
      div.style.height = `${80 + Math.random() * 180}px`;
      div.style.animationDelay = `${Math.random() * 4}s`;
      div.style.animationDuration = `${2.5 + Math.random() * 2}s`;
      div.style.opacity = `${0.3 + Math.random() * 0.4}`;
      container.appendChild(div);
      lines.push(div);
    }

    return () => { lines.forEach(l => l.remove()); };
  }, []);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9996 }} />;
}
