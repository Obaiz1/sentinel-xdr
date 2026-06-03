# SENTINEL XDR — Latest UI Fix Plan

Driven by deployed-site feedback + the 34 Stitch screenshots. Backend unchanged.

## Phase 1 — Root-cause analysis (current `/new`)

| Issue | Cause (file) | Fix |
|---|---|---|
| **ARIA always open on right** | `AppShell.tsx` renders a permanent `<aside className="cc-aria"><AriaPanel/></aside>`; `.cc-body` CSS reserves a 3rd grid column `var(--cc-aria)` (350px). | Remove the rail; `.cc-body` → 2 columns; ARIA becomes a floating FAB (`.sv-aria-fab`, always visible) opening the existing overlay panel (`.sv-aria-panel`, bottom-right on desktop / full-width sheet on mobile). The `ARIA Copilot` nav item opens the same panel. |
| **Metric cards static** | `CommandCenter.tsx` `Kpi` is a plain `<div>`. | Make each a `<button>` with cursor/hover/arrow + keyboard access; wire real actions via a new `NavContext`. |
| **No cloud/demo clarity** | `CommandCenter`/`SnifferControlPanel` don't surface that cloud has no Npcap. | Detect cloud via `/status` `system.platform` (≠ Windows ⇒ no live capture). Add "Cloud Preview Mode" banner, source chips, disabled Start-sniffer tooltip. |
| **Control Panel vs Stitch** | `SnifferControlPanel.tsx` already has state machine + dark `Dropdown` + admin message, but lacks queue meters, status badges, cloud banner. | Add those (no new APIs). |

## Phase 2 — ARIA floating (all breakpoints)
Desktop: floating glass orb FAB bottom-right with status dot → click opens docked panel overlay (does NOT shrink dashboard). Mobile: full-width bottom sheet. Close button hides it. States: online/offline/thinking/streaming/error via `AriaPanel` (already streams `POST /api/aria/chat` only).

## Phase 3 — Clickable KPI cards (real actions, existing APIs)
- Packets Captured → navigate **Control Panel**
- Critical Threats → **Live Alerts** + filter `level=Critical` (via NavContext)
- AI Analyzed → **detail drawer**: `llm_analyzer`, `rag_engine`, queue (`/status`)
- Alerts Detected → **Live Alerts**
- Active Chains → **MACE Chains**
- Queue Load → **detail drawer**: `queues.packet/llm` (`/status`)
Each card: source chip = Demo / Live / Backend / Empty (from `/status`).

## Phase 4 — Control Panel + cloud messaging
Cloud Preview banner; Start disabled w/ tooltip on cloud; Demo prominent; packet+LLM queue meters; status badges API/DB/LLM/RAG/Sniffer/Demo; admin-required + offline copy. APIs: `/interfaces`, `/toggle-sniffing`, `/api/sniffer/demo/{start,stop}`, `/status`.

## Phase 5–7 — Copy, Settings, responsive
Empty-state copy mentions Demo (cloud) vs local sniffer. Settings → "Live Sniffer Setup" guidance + `NEXT_PUBLIC_API_BASE_URL`. Verify 390/430/768/1024/1440, no horizontal scroll, FAB doesn't overlap.

## Phase 8–9 — Build + deploy + report
`npm run build`+`lint`; deploy via Git push to `main` (Vercel auto-builds — CLI deploys get killed here). Write `LATEST_UI_FIX_REPORT.md`.

## Backend support matrix (unchanged)
Real: `/status`, `/statistics`, `/alerts`, `/alerts/recent`, `/alerts/{id}`, `/chains`, `/api/chronicle/{id}`, `/api/engines/{engine}/run`, `/api/aria/chat`, `/interfaces`, `/toggle-sniffing`, `/api/sniffer/demo/{start,stop}`. No new endpoints. No keys in frontend. Cloud = no live Npcap → Demo Mode powers packet telemetry; everything else stays real.
