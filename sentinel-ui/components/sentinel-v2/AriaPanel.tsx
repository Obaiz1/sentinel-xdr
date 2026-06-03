"use client";

import { useEffect, useRef, useState } from "react";
import { streamAriaChat, ApiError } from "@/lib/apiClient";
import { IconAria, IconSend } from "./Icons";

interface Msg { role: "user" | "assistant"; content: string }

/**
 * AriaPanel — the ARIA Copilot chat surface (screenshots 03/06 right rail + 17/22).
 * Talks ONLY to the backend /api/aria/chat (streamed). No direct LLM calls.
 * Reused by the desktop rail and the mobile bottom-sheet.
 */
export default function AriaPanel({ onClose }: { onClose?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "ARIA online. Ask me about active threats, alerts, attack chains, or engine status." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [now, setNow] = useState("--:--:--"); // set after mount to avoid SSR/client hydration mismatch
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNow(new Date().toTimeString().slice(0, 8)); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput(""); setStreaming(true);
    try {
      let acc = "";
      for await (const chunk of streamAriaChat(text, history)) {
        acc += chunk;
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: acc }; return c; });
      }
      if (!acc) throw new ApiError("http", "empty");
    } catch (e) {
      const offline = e instanceof ApiError && (e.kind === "offline" || e.kind === "timeout");
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: offline ? "ARIA is offline — start the backend or check NEXT_PUBLIC_API_BASE_URL." : "ARIA hit an error. Please try again." }; return c; });
    } finally { setStreaming(false); }
  }

  return (
    <>
      <div className="cc-aria-head">
        <span className="sv-aria-ring" style={{ width: 32, height: 32 }}><IconAria style={{ width: 16, height: 16, color: "var(--neon-purple)" }} /></span>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: "0.12em", color: "var(--neon-purple)" }}>ARIA COPILOT</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--neon-green)" }}>Analyst · Online_</div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close ARIA" style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, width: 32, height: 32 }}>×</button>
        )}
      </div>

      <div ref={scrollRef} className="cc-aria-log">
        <div className="cc-aria-sys">[{now}] <b>SYS&gt;</b> Initializing MACE chain analysis…</div>
        <div className="cc-aria-sys">[{now}] <b>SYS&gt;</b> Telemetry link established. Awaiting operator query.</div>
        {msgs.map((m, i) => (
          <div key={i} className={`sv-bubble ${m.role === "user" ? "sv-bubble-user" : "sv-bubble-ai"}`}>
            {m.content || (streaming && i === msgs.length - 1 ? "▍" : "")}
          </div>
        ))}
      </div>

      <div className="cc-aria-input">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="&gt;_ Query telemetry, analyse…"
          style={{ flex: 1, minWidth: 0, height: 40, padding: "0 12px", borderRadius: 10, fontSize: 12.5 }}
        />
        <button type="button" className="sv-btn" aria-label="Send to ARIA" onClick={send} disabled={streaming || !input.trim()}
          style={{ borderColor: "rgba(168,85,247,0.5)", color: "var(--neon-purple)", background: "rgba(168,85,247,0.12)", minWidth: 44, padding: "0 12px" }}>
          <IconSend style={{ width: 16, height: 16 }} />
        </button>
      </div>
    </>
  );
}
