# LEGACY_FRONTEND_BACKUP_PLAN.md
**How to preserve the current frontend and switch between old (legacy) and new UI — safely.**

> Golden rule: **never delete or overwrite the current frontend.** Every step below is additive and reversible. Nothing here touches the backend, database, APIs, sniffer, chatbot logic, or deployment behavior.

---

## 0. Current state (important)
- The project is **NOT a git repository yet** (git v2.45.2 is installed). There is no version-control safety net today.
- The frontend lives in `sentinel-ui/` and deploys to Vercel. The backend is untouched by any of this.

## 1. Backup layer 1 — Version control (do this first)
```bash
# from the project root: AI-IDS-main/AI-IDS-main
git init
git add -A
git commit -m "Snapshot: working SENTINEL XDR before frontend redesign"

# Tag the legacy UI so it can always be recovered exactly
git tag legacy-frontend-v1

# Create the planning/work branch (keep main pristine)
git checkout -b frontend-redesign-planning
```
- `.gitignore` already excludes `.env`, `venv/`, `node_modules/`, `.next/`, `*.db`, `chroma_db/` — secrets and build artifacts won't be committed. **Verify `.env` is ignored before the first commit.**
- To revert at any time: `git checkout main` (or `git checkout legacy-frontend-v1`).

## 2. Backup layer 2 — Physical copy (belt & suspenders)
Before editing the frontend, snapshot the folder (excluding heavy/regenerable dirs):
```powershell
# PowerShell, from sentinel-ui's parent
Copy-Item -Recurse -Force sentinel-ui sentinel-ui_legacy_backup `
  -Exclude node_modules,.next
```
This gives an untouched on-disk copy you can restore by renaming, independent of git.

## 3. Switching architecture — RECOMMENDED approach
**Keep ONE Next.js app; serve both UIs from it.** This is the cleanest for a single Vercel deploy and instant rollback.

### 3a. Folder structure
```
sentinel-ui/
├── components/
│   ├── legacy/        ← move current components here UNCHANGED
│   │   ├── HeroGlobe.tsx  StatusBar.tsx  ControlPanel.tsx  ChatPanel.tsx
│   │   ├── ThreatCharts.tsx  XDRPanel.tsx  XDREngines.tsx  AlertFeed.tsx
│   │   └── Dropdown.tsx  StateMessage.tsx  FloatingObjects.tsx  DataStreams.tsx
│   └── (new components live at components/ root or components/v2/)
├── app/
│   ├── page.tsx            ← thin switch: renders <NewDashboard/> or <LegacyDashboard/>
│   ├── legacy/page.tsx     ← always renders the legacy dashboard (hard route)
│   └── (new)/page.tsx      ← optional explicit new route
└── lib/  hooks/  …
```

### 3b. Route structure
- `/` → default UI, chosen by the env flag (below).
- `/legacy` → **always** the old UI (hard-coded import of `components/legacy/*`). Guaranteed escape hatch.
- `/new` (optional) → **always** the new UI, for side-by-side QA.

### 3c. Env-variable / feature-flag switch (recommended primary mechanism)
Add to `.env.local` (and Vercel project env):
```
NEXT_PUBLIC_UI_VERSION=legacy   # or: new
```
```tsx
// app/page.tsx
import LegacyDashboard from "@/components/legacy/LegacyDashboard";
import NewDashboard from "@/components/NewDashboard";
export default function Page() {
  const v = process.env.NEXT_PUBLIC_UI_VERSION ?? "legacy";
  return v === "new" ? <NewDashboard /> : <LegacyDashboard />;
}
```
- **Phased rollout:** keep `legacy` as default until the new UI is approved, then flip to `new` — one env change, redeploy, done. Revert = flip back.
- Optional **Settings toggle** can set a cookie/localStorage override that wins over the env default, so you can preview `new` in production without changing the global default.

### 3d. Why this beats the alternatives
| Option | Verdict |
|---|---|
| **Same app + env flag + `/legacy` route** (recommended) | One deploy, instant flip, hard-route escape hatch, no infra changes |
| Separate Vercel project for new UI | Works but doubles deploy/config and splits the env (tunnel URL) in two places |
| Separate git branch only | Good for history, but you can't A/B at runtime; combine with the env flag |
| Delete old, build new | ❌ violates the "never lose legacy" rule |

## 4. How to revert safely (any time)
1. **Instant (runtime):** set `NEXT_PUBLIC_UI_VERSION=legacy` in Vercel → redeploy. Or visit `/legacy`.
2. **Code-level:** `git checkout legacy-frontend-v1` (or `main`).
3. **Filesystem:** restore `sentinel-ui_legacy_backup/`.
The backend never changes, so reverting the UI can never break APIs/data.

## 5. Deploy both versions without conflict
- **Single project (recommended):** `/`, `/legacy`, `/new` all ship in one Vercel build. Flag picks the default. No conflict.
- Ensure **`NEXT_PUBLIC_API_BASE_URL`** (the backend URL) is set **once** in Vercel env and shared by both UIs.
- Because `NEXT_PUBLIC_*` is build-time-inlined, **redeploy after changing** the backend URL or the UI flag.

## 6. Guardrails (do-not-touch list)
- Do **not** edit: `main.py`, `config.py`, `database.py`, `modules/*`, `.env`, the sniffer/ARIA/MACE logic, or CORS/deploy config as part of the UI redesign.
- Keep all **LLM keys backend-only**; the new UI must call `/api/aria/chat`, never an LLM directly.
- Don't commit `.env` / `.env.local`.
