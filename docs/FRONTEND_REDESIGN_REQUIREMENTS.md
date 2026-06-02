# FRONTEND_REDESIGN_REQUIREMENTS.md
**SENTINEL XDR / AI-IDS — New Frontend Requirement Report**
_Written to be handed to ChatGPT, which will convert it into a Stitch prompt for generating the new UI._

> Instruction to ChatGPT: Use this document to produce a single, detailed **Stitch** design prompt for a multi-screen, dark cyberpunk **SOC / XDR command-center dashboard**. Preserve the brand identity described here. Output responsive layouts for mobile, tablet, and desktop. Do not invent backend behavior — consume the APIs listed in `API_REQUIREMENTS_MAP.md`.

---

## 1. Product name & concept
**SENTINEL XDR / AI-IDS** — an Autonomous XDR + AI Threat-Intelligence command center. It captures network telemetry, triages threats with heuristics + an LLM, correlates multi-stage attacks (MACE), profiles attackers (PHANTOM), detects AI-evasion (AEGIS), can respond autonomously (ADRS, gated), narrates incidents (CHRONICLE), and provides a conversational SOC analyst (ARIA). Audience: SOC analysts / security engineers. Tone: **military-grade, futuristic, trustworthy, calm under pressure.**

## 2. Design style (preserve the existing identity)
- **Dark cyberpunk** base (`#040a14` deep navy/near-black).
- Neon accents: **cyan `#00d4ff`** (primary), **green `#00ff88`** (healthy/active), **purple `#a855f7`** (AI/medium), **orange `#ff9900`** (warning/high), **red `#ff3366`** (critical/error).
- **Glassmorphism** cards (blurred translucent panels, 1px neon-tinted borders, soft outer glow).
- Subtle **scanline + CRT vignette** overlays; **hex-grid** background texture.
- Fonts: **Orbitron** (display/headings), **Share Tech Mono** (mono/labels/data), **Inter** (body).
- Motion: tasteful and **performance-friendly** (entrance fades, pulsing status dots, animated arcs/rings). Respect `prefers-reduced-motion`.
- Accessibility: WCAG-AA contrast on text, focus rings (cyan), pinch-zoom allowed.

## 3. Required pages / sections
A primary **dashboard** plus logically separated sections (can be one app-shell with anchored sections or true routes — see §10):
1. **Hero / Landing** — animated globe with attack arcs, product title, live system pulse.
2. **API / Backend Status panel** — API online, DB, LLM, RAG, sniffer, queues + Retry.
3. **Control Panel** — interface selector, Start/Stop Sniffer, **Demo Mode**, queue meters.
4. **ARIA AI Copilot** — chat widget (dockable desktop / bottom-sheet mobile).
5. **XDR Engine Suite** — six runnable engine cards (MACE, ARIA, ADRS, PHANTOM, AEGIS, CHRONICLE) with status + result panel.
6. **Threat Intelligence Dashboard** — Threat Distribution, Protocol Breakdown, Alert Timeline, Top Attack Vectors.
7. **MACE Attack Chains** — active chains with kill-chain phases + "Generate CHRONICLE report".
8. **Live Alerts Stream** — filterable, expandable alert rows.
9. **Settings / Configuration** — API base URL display, theme, refresh interval, **UI version switch (legacy/new)**.
10. **Legacy frontend switch / route** — see `LEGACY_FRONTEND_BACKUP_PLAN.md`.

## 4. Required components (reusable)
- **AppShell / Layout** (header + responsive sidebar/drawer + content grid).
- **Responsive Navbar/Sidebar** (collapses to a mobile drawer / bottom nav).
- **HeroGlobe** (3D globe with attack arcs + user location; lazy-loaded, client-only, SSR-safe).
- **StatusBadge** + **StatusBar** (wrapping pill row: API/SNIFFER/LLM/RAG/DB + counters).
- **StatCard** / **MetricChip**.
- **SnifferControlCard** (interface **Dropdown**, Start/Stop, Demo, states, queue bars).
- **ChatWidget (ARIA)** (history, input, send-on-Enter, streaming, states).
- **EngineCard** (code badge, name, desc, status dot, Run button) + **EngineResultPanel**.
- **ChartCard** wrappers: Donut (distribution), Bar (protocols/vectors), Area (timeline).
- **AlertList / AlertRow** (badge, vector, src→dst, confidence, expandable detail).
- **ApiStatusIndicator** (online/offline/latency + Retry).
- **State components:** **LoadingSkeleton**, **EmptyState**, **ErrorState/OfflineState** (with Retry) — never "awaiting data forever".
- **Dropdown** (fully dark custom listbox — no native white popups), **Modal/Sheet**, **MobileDrawer**, **DesktopGrid**.

## 5. Responsiveness requirements
- **Desktop (≥1024):** full command-center grid (multi-column), persistent sidebar, ARIA docked.
- **Tablet (768–1023):** 2-column card layout, collapsible sidebar.
- **Mobile (≤767):** single-column stacked; sidebar → drawer; ARIA → full-width bottom sheet; Control Panel → sheet (must **not overlap** content or other FABs).
- **No horizontal scrolling** at any width. Test at **390, 430, 768, 1024, 1440 px** (+ ultrawide).
- Headings use **`clamp()`**; status badges **wrap**; cards **stack**; the interface dropdown stays **inside its card**; all buttons remain tappable (≥40px targets).

## 6. Data integration requirements
- All data comes from the backend APIs in `API_REQUIREMENTS_MAP.md` — **no hardcoded fake success**.
- Every data surface implements **loading → data / empty / error(offline+Retry)**.
- Poll cadence: status 3 s, alerts 2–3 s, statistics 5 s, chains 6 s; OR subscribe to `/ws/alerts`.
- Empty arrays show **actionable guidance** ("Start Demo Mode or the sniffer").
- **No secret keys in the browser.** LLM calls go only through the backend.

## 7. Backend connection requirements
- Single env var **`NEXT_PUBLIC_API_BASE_URL`** (alias/standardize from current `NEXT_PUBLIC_API_URL`).
- **No localhost/ngrok hardcoded** in production builds. Prefer a **stable** backend URL (deployed host / Cloudflare Tunnel / reverse proxy) over ephemeral `*.lhr.life`. Optionally a **runtime `/config` fetch** so the URL isn't frozen at build time.
- One **API client helper** with base URL, **timeout** (~8 s), **retry** (1–2), typed errors, and the `ngrok-skip-browser-warning` header.
- Backend **CORS** restricted to the Vercel origin in production.

## 8. Sniffer frontend requirement
- **Interface dropdown** (friendly labels for `\Device\NPF_{GUID}`, raw value preserved).
- **Start** and **Stop** buttons (derive from `/toggle-sniffing` + `/status.sniffer.is_running`).
- States: **idle · starting · running · stopping · error**, plus **backend-offline** and **admin-required**.
- Show backend response/message clearly. On a capture-permission failure show:
  > "Sniffer needs admin/root permission on the backend agent machine (install Npcap and run the backend as Administrator)."
- Provide **Demo Mode** toggle (safe synthetic data) for environments without capture.

## 9. ARIA chatbot requirement
- Chat **input** + scrollable **history**; **send on Enter**; streaming token render.
- **Loading** indicator while awaiting/streaming.
- Friendly **error** if backend/LLM offline ("ARIA is offline — start the backend / check the API URL").
- **Backend-only** LLM calls via `POST /api/aria/chat` (NVIDIA primary; Gemini/Groq fallback).
- **Context-aware**: backend already injects recent alerts/chains/RAG; frontend just sends `{message, history}`.
- Mobile: full-width bottom sheet; desktop: docked panel that never overflows the viewport.

## 10. Old/New frontend switching requirement
See `LEGACY_FRONTEND_BACKUP_PLAN.md` for the full plan. Summary recommendation:
- **Folder + route + env flag combo:** keep the current UI under a **`/legacy`** route (and/or `components/legacy/`), build the new UI as the default; gate via **`NEXT_PUBLIC_UI_VERSION=legacy|new`** with a Settings toggle, all inside the **same Next.js app** so one Vercel deploy serves both and reverting is instant.

---

## Appendix — exact data contracts for the Stitch prompt
- **System status** fields: API online, sniffer `{is_running, packets_captured}`, llm `{is_running, analyzed_count}`, rag `{initialized, document_count}`, db `{connected}`, queues `{packet_queue_size/max, llm_queue_size/max}`, demo `{running, generated}`.
- **Alert** card fields: time, threat level (Critical/High/Medium/Low), attack vector, `src_ip→dst_ip · protocol`, confidence %, expandable detail (ports, flags, MITRE technique, recommended action, explanation, triage flags).
- **Statistics**: `threat_distribution[{threat_level,count}]`, `protocol_breakdown[{protocol,count}]`, `threat_timeline[{minute_bucket,count}]`, `top_attack_vectors[{attack_vector,count}]`.
- **Chain** card: `chain_id`, `actor_id`, `chain_score` (0–100, color by severity), `kill_chain_phases[]`, action to generate CHRONICLE narrative.
- **Engine run result**: `{title, status(success|error|empty|not_configured), summary, metrics{}, items[{label,value}]}`.
- **Colors → meaning:** green=healthy/low, cyan=primary/info, purple=AI/medium, orange=warning/high, red=critical/error/offline.
