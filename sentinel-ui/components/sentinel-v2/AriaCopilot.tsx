"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { streamAriaChat, ApiError } from "@/lib/apiClient";

interface Msg { role: "user" | "assistant"; content: string }

export default function AriaCopilot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "ARIA online. Ask me about active threats, alerts, or attack chains." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      let acc = "";
      for await (const chunk of streamAriaChat(text, history)) {
        acc += chunk;
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      if (!acc) throw new ApiError("http", "empty");
    } catch (e) {
      const offline = e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout");
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: offline
            ? "ARIA is offline — start the backend or check NEXT_PUBLIC_API_BASE_URL."
            : "ARIA hit an error. Please try again.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <button type="button" className="sv-aria-fab" aria-label="Open ARIA copilot" onClick={() => setOpen((o) => !o)}>
        <span className="sv-aria-ring">
          <span style={{ fontSize: 18 }}>🤖</span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="sv-aria-panel"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.25 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid rgba(168,85,247,0.25)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.12em", color: "var(--neon-purple)" }}>
                <span className="sv-dot sv-pulse-dot" style={{ background: "var(--neon-purple)", boxShadow: "0 0 8px var(--neon-purple)" }} />
                ARIA COPILOT
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, minWidth: 32, minHeight: 32 }}>×</button>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {msgs.map((m, i) => (
                <div key={i} className={`sv-bubble ${m.role === "user" ? "sv-bubble-user" : "sv-bubble-ai"}`}>
                  {m.content || (streaming && i === msgs.length - 1 ? "…" : "")}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid rgba(168,85,247,0.25)" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask ARIA…"
                style={{ flex: 1, padding: "9px 12px", fontSize: 13, minHeight: 40 }}
              />
              <button type="button" className="sv-btn" onClick={send} disabled={streaming || !input.trim()} style={{ borderColor: "rgba(168,85,247,0.5)", color: "var(--neon-purple)", background: "rgba(168,85,247,0.12)" }}>
                {streaming ? "…" : "Send"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
