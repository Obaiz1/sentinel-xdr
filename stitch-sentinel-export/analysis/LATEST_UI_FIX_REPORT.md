# SENTINEL XDR — Latest UI Fix Report

Branch `stitch-ui-integration` → merged to `main` → Vercel auto-deploy. Backend Python untouched.

1. **ARIA changed from permanent panel to floating icon?** ✅ Yes. Removed the permanent right rail (`AppShell` `.cc-aria` + 3rd grid column); `.cc-body` is now 2-column so the dashboard uses full width.
2. **ARIA desktop behavior:** Floating glass orb FAB (bottom-right, purple ring + green status dot). Click → docked overlay panel (`.sv-aria-panel`, ~380px, does **not** shrink the dashboard). Close button (×) or backdrop-less click-toggle hides it. The "ARIA Copilot" sidebar item opens the same panel. States online/streaming/error/offline come from `AriaPanel` (streams `POST /api/aria/chat` only — no direct LLM).
3. **ARIA mobile behavior:** Same FAB; tap → full-width bottom sheet (`.sv-aria-panel` @≤767px, 78dvh) with a dimming backdrop (mobile-only) and a clear × close. Chat input stays visible; no horizontal overflow.
4. **Metric cards clickable?** ✅ All 6 are `<button>`s (cursor, hover arrow, focus ring, keyboard, `aria-label`):
   - Packets Captured → navigate **Control Panel**
   - Critical Threats → **Live Alerts** + `level=Critical` (via `NavContext` → `LiveAlertsStream`)
   - AI Analyzed → **detail drawer** (LLM running, analyzed count, LLM queue, RAG loaded/docs, DB)
   - Alerts Detected → **Live Alerts** (filter cleared)
   - Active Chains → **MACE Chains**
   - Queue Load → **detail drawer** (packet/LLM queue size/max, sniffer, demo)
   Each card shows a **source chip**: Demo telemetry / Live capture / Backend / No telemetry (from `/status`).
5. **Control Panel updated from Stitch?** ✅ Added: status badge row (API/DB/LLM·ARIA/RAG/Sniffer/Demo), **Cloud Preview Mode** banner, packet + LLM queue meters, prominent **Start Demo Mode**, Start-Sniffer **disabled on cloud** with tooltip "Available only on a local/backend agent with Npcap." Kept dark custom `Dropdown`, friendly interface labels (raw value preserved), admin-required + offline copy.
6. **Backend APIs used:** `/status`, `/statistics`, `/alerts`, `/alerts/recent`, `/alerts/{id}`, `/chains`, `/api/chronicle/{id}`, `/api/engines/{engine}/run`, `/api/aria/chat`, `/interfaces`, `/toggle-sniffing`, `/api/sniffer/demo/{start,stop}`. No new endpoints; no keys in frontend.
7. **Unsupported features omitted/disabled:** Live sniffing on cloud → disabled + Cloud Preview banner (not faked). Raw-hex forensics + CVE queue remain disabled-state (from prior pass). No fabricated data anywhere.
8. **Responsive:** sidebar→drawer ≤980px; KPI grid 3→2→1; FAB fixed bottom-right (doesn't reserve layout); ARIA panel → full-width sheet ≤767px; detail drawer → 100vw ≤560px; `min-width:0` guards. Build-level verified; recommend a final eyes-on pass at 390/430/768/1024/1440.
9. **Build:** ✅ `npm run build` compiled successfully, TypeScript clean, all routes generated. `npm run lint` 0 errors (6 pre-existing legacy warnings).
10. **Vercel deploy status:** Deployed by pushing `main` (Vercel Git auto-build; CLI deploys are killed in this harness). Production: https://sentinel-xdr.vercel.app. Backend: https://obaiz-sentinel-xdr-backend.hf.space.
11. **Remaining issues:** Cloud detection relies on `/status.system.platform` (Linux ⇒ cloud) — robust for the current HF backend. Full pixel-for-pixel Stitch alignment and a live multi-breakpoint visual QA are recommended as a follow-up. `cc-aria` rail CSS left in place but unused (harmless).
