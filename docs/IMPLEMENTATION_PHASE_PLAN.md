# IMPLEMENTATION_PHASE_PLAN.md
**SENTINEL XDR / AI-IDS — Frontend Redesign Implementation Plan**
_Do not start the rebuild until the analysis is approved._

Each phase lists: goal · key tasks · safety · exit criteria. Backend, DB, APIs, sniffer, ARIA, and deployment behavior are **not modified** by this plan (except the small, isolated API-client/env cleanup in Phase 2).

---

## Phase 1 — Backup the current frontend
**Goal:** make the legacy UI permanently recoverable before any change.
- `git init` + commit snapshot; tag `legacy-frontend-v1`; branch `frontend-redesign-planning` (see `LEGACY_FRONTEND_BACKUP_PLAN.md`).
- Confirm `.env`/`.env.local` are gitignored; create physical `sentinel-ui_legacy_backup/`.
- Move current components into `components/legacy/` **unchanged**; add a `/legacy` route that renders them.
- **Exit:** `/legacy` renders the exact current UI; `git checkout legacy-frontend-v1` restores everything.

## Phase 2 — Fix API client / env handling (small, isolated)
**Goal:** one robust, configurable data layer (prereq for both UIs).
- Standardize on **`NEXT_PUBLIC_API_BASE_URL`** (keep `NEXT_PUBLIC_API_URL` as a fallback alias).
- Create one **`lib/apiClient.ts`**: base URL, timeout (~8 s), retry (1–2), typed errors, `ngrok-skip-browser-warning` header; expose typed calls for every endpoint in `API_REQUIREMENTS_MAP.md`.
- Deprecate the duplicate clients (`lib/api.ts`, ad-hoc `hooks/*`) — keep legacy working by re-pointing it at the new client or leaving it untouched under `legacy/`.
- Remove/repurpose the orphaned `app/api/chat/route.ts` (route ARIA only through the Python backend; do not ship LLM keys to Vercel).
- Tighten backend **CORS** to the Vercel origin (backend-side, coordinate separately).
- **Exit:** legacy UI still works through (or alongside) the new client; offline/empty/error states resolve correctly.

## Phase 3 — Build the new frontend in isolation
**Goal:** create the new UI without touching legacy.
- Generate the design via **Stitch** (from `FRONTEND_REDESIGN_REQUIREMENTS.md` → ChatGPT → Stitch prompt).
- Build new components at `components/` root (or `components/v2/`), assemble `NewDashboard`, wire the env flag in `app/page.tsx`, add `/new` route for QA.
- Implement AppShell, responsive sidebar/drawer, all reusable components, and the loading/empty/error/offline states.
- **Exit:** `/new` renders the full new UI with mock/real data; `/legacy` untouched; flag defaults to `legacy`.

## Phase 4 — Connect APIs
**Goal:** real data end-to-end in the new UI.
- Wire every panel to `lib/apiClient.ts`; implement polling cadence (or `/ws/alerts` subscription for the stream).
- Sniffer control (start/stop/demo + all states + admin-required message); ARIA streaming chat; engine Run cards; charts from `/statistics`; chains + CHRONICLE.
- Validate against a **reachable backend** (local `127.0.0.1:8000` or a live tunnel) with **Demo Mode** for data.
- **Exit:** with backend up + Demo Mode on, all panels populate; with backend down, all show offline+Retry (no infinite spinners).

## Phase 5 — Responsive testing
**Goal:** flawless across breakpoints.
- Verify **390 / 430 / 768 / 1024 / 1440 px** + ultrawide: no horizontal scroll, no overlap, badges wrap, cards stack, dropdown contained, ARIA fits width, FABs/sheets don't collide.
- Check `prefers-reduced-motion`, focus states, contrast.
- **Exit:** all breakpoints pass; `npm run build` exit 0.

## Phase 6 — Production deployment
**Goal:** ship the new UI, keep legacy reachable.
- Set Vercel env: `NEXT_PUBLIC_API_BASE_URL` (stable backend URL), `NEXT_PUBLIC_UI_VERSION` (start `legacy`, flip to `new` after sign-off).
- Prefer a **stable backend URL** (deployed host / Cloudflare Tunnel) over ephemeral `*.lhr.life`; remember `NEXT_PUBLIC_*` is build-time-inlined → **redeploy** when the URL changes.
- Deploy; smoke-test `/`, `/new`, `/legacy`; verify ARIA + data against the live backend.
- **Exit:** live site serves the chosen UI; `/legacy` still works; rollback = flip the flag + redeploy.

## Phase 7 — (Optional) Remove legacy after approval
**Goal:** retire legacy only once the new UI is confirmed good in production.
- Keep legacy for an agreed soak period.
- When approved: remove the `/legacy` route + `components/legacy/` in a dedicated commit (recoverable via `legacy-frontend-v1` tag forever).
- **Exit:** single new UI in production; legacy retained in git history/tag.

---

### Sequencing & risk notes
- Phases 1→2 are prerequisites; 3 and 4 can overlap; 5 gates 6; 7 is optional and last.
- The only backend-adjacent change in this plan is **CORS tightening** (Phase 2) — coordinate so it doesn't block the dev origin.
- Keep the **legacy escape hatch** (`/legacy` + tag) until Phase 7 is explicitly approved.
