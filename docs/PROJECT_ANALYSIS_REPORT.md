# PROJECT_ANALYSIS_REPORT.md
**SENTINEL XDR / AI-IDS — Full Project Analysis**
_Analysis only. No rebuild performed. Last updated: 2026-06-02._

---

## 0. Executive summary

SENTINEL XDR is a **defensive, AI-powered Intrusion Detection / XDR dashboard**. It has two halves:

- **Backend** — a Python **FastAPI** application (`main.py`) that captures network packets (Scapy), runs heuristic triage, classifies threats with an LLM, correlates multi-stage attack chains (MACE), and exposes a REST + WebSocket API on port **8000**.
- **Frontend** — a **Next.js 16 (App Router, React 19, Turbopack)** single-page dashboard in `sentinel-ui/`, deployed to **Vercel** at `https://sentinel-ai-ids.vercel.app/`.

The frontend reaches the backend over the public internet via an **SSH tunnel** (`*.lhr.life`, ngrok-style) whose URL is injected through `NEXT_PUBLIC_API_URL`.

> **Most important finding:** the **live Vercel site is an OLD build** from before the recent fixes, AND its configured backend tunnel is **dead**. So on the live URL: the globe crashes, ARIA hits a quota error, and every data panel is empty — because the frontend is calling a backend that no longer answers. The **local build is fully fixed** but has **not been redeployed**.

---

## PHASE 1 — Project Structure Analysis

### 1.1 Frameworks
| Layer | Technology |
|---|---|
| Frontend framework | **Next.js 16.2.4** (App Router) + **React 19**, Turbopack, TypeScript |
| Styling | Tailwind v4 + a large custom `globals.css` (cyberpunk theme, CSS variables) |
| Animation / 3D | framer-motion, @react-three/fiber + drei + three, react-globe.gl, GSAP, recharts |
| Backend framework | **FastAPI** (uvicorn) + Pydantic / pydantic-settings |
| Packet capture | **Scapy** (`AsyncSniffer`) — needs Npcap + Administrator on the host |
| Database | **SQLite** via `aiosqlite` (`ids_data.db`) |
| Vector store / RAG | **ChromaDB** (`./chroma_db`, 25 MITRE ATT&CK docs) |
| LLM | **NVIDIA NIM** (primary, OpenAI-compatible) → Gemini → Groq (fallbacks) |

### 1.2 Folder structure (relevant)
```
AI-IDS-main/AI-IDS-main/
├── main.py                 # FastAPI app + all routes + engine wiring
├── config.py               # pydantic-settings (env-driven config)
├── database.py             # aiosqlite DatabaseManager (alerts, chains, profiles…)
├── .env / .env.example     # backend secrets (gitignored)
├── requirements.txt
├── knowledge_base/threat_intel.json
├── modules/
│   ├── sniffer.py          # Scapy AsyncSniffer + PacketRecord
│   ├── triage.py           # heuristic rules → TriagedPacket
│   ├── llm_client.py       # LLMAnalyzer (packet → threat JSON)
│   ├── nvidia_llm.py       # NVIDIA NIM async client (httpx)  [added in fixes]
│   ├── aria.py             # ARIA chat copilot (multi-provider)
│   ├── correlation.py      # MACE attack-chain engine
│   ├── response.py         # ADRS autonomous response (firewall) 
│   ├── phantom.py          # attacker memory profiling
│   ├── aegis.py            # AI prompt-injection / evasion detection
│   ├── chronicle.py        # executive incident narrative (LLM)
│   └── demo.py             # safe synthetic-event generator  [added in fixes]
└── sentinel-ui/            # ← FRONTEND (deployed to Vercel)
    ├── app/
    │   ├── layout.tsx      # root layout, fonts, metadata, viewport
    │   ├── page.tsx        # the entire dashboard (one page)
    │   ├── globals.css     # theme + form controls + dropdown styles
    │   └── api/chat/route.ts   # ⚠ SECOND chatbot path (Next server → Gemini/Groq)
    ├── components/
    │   ├── HeroGlobe.tsx   StatusBar.tsx   ControlPanel.tsx   ChatPanel.tsx
    │   ├── ThreatCharts.tsx  XDRPanel.tsx   XDREngines.tsx
    │   ├── AlertFeed.tsx   MetricsTable.tsx (unused)
    │   ├── Dropdown.tsx    StateMessage.tsx (added in fixes)
    │   └── FloatingObjects.tsx  DataStreams.tsx
    ├── hooks/              # useAlerts / useStatistics / useSystemStatus (SWR-style)
    ├── lib/
    │   ├── backend.ts      # backendGet/backendPost/backendStream (USED by components)
    │   └── api.ts          # typed `api` client + SWR fetcher (LEGACY/partly unused)
    └── .env.local          # NEXT_PUBLIC_API_URL (the tunnel URL)
```

### 1.3 Main frontend pages/components
- **Single route** (`app/page.tsx`) renders everything: Hero → StatusBar → XDR Engine Suite → Threat Intelligence (charts) → MACE chains → Live Alert Stream → footer. Two floating overlays: ControlPanel (⚙) and ChatPanel (🤖).
- There is **no router/multi-page structure** — everything is one client page.

### 1.4 Backend routes (see `API_REQUIREMENTS_MAP.md` for the full table)
All defined in `main.py`. REST + one WebSocket (`/ws/alerts`).

### 1.5 State management
- **No global store** (no Redux/Zustand/Context). Each component holds local `useState` and polls the backend on its own `setInterval` (2–6 s). Hooks in `hooks/` use SWR but are largely **not wired into the rendered components** (the components call `lib/backend.ts` directly).

### 1.6 API client / fetch logic — **fragmented (3 layers)**
1. `lib/backend.ts` — `backendGet/backendPost/backendStream`, base = `NEXT_PUBLIC_API_URL ?? http://127.0.0.1:8000`, adds `ngrok-skip-browser-warning`. **This is what the live components use.**
2. `lib/api.ts` — a typed `api.*` client + SWR `fetcher`, base = `NEXT_PUBLIC_API_URL ?? http://localhost:8000`. **Mostly unused.**
3. `hooks/useAlerts|useStatistics|useSystemStatus` — own `API_URL` constant. **Largely unused by the rendered page.**
> This triple-duplication is a key reason the codebase is hard to reason about and should be **consolidated into one client** in the redesign.

### 1.7 Environment variables
**Backend (`.env`, gitignored, server-only):** `LLM_PROVIDER`, `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `SNIFF_INTERFACE`, plus many tunables in `config.py`.
**Frontend (`sentinel-ui/.env.local`):** `NEXT_PUBLIC_API_URL` (currently a dead `*.lhr.life` tunnel). `app/api/chat/route.ts` also reads `GEMINI_API_KEY`/`GROQ_API_KEY` as **Vercel server env** (separate from the Python backend).

### 1.8 Deployment setup
- **Frontend:** Vercel (`sentinel-ui`). Build verified locally (`next build` → exit 0).
- **Backend:** cannot run on Vercel (needs long-lived process, Scapy, Npcap, admin). Runs on a local/host machine; exposed via an **ephemeral `*.lhr.life` SSH tunnel**.
- **Repo:** the project is **NOT a git repository** yet (git is installed, v2.45.2). No `.vercel` link, no Vercel CLI on this machine.

### 1.9 Where localhost/ngrok/hardcoded URLs appear
- `lib/backend.ts`, `lib/api.ts`, `hooks/*` all default to `localhost:8000` if `NEXT_PUBLIC_API_URL` is unset — fine for dev, must be a real URL in prod.
- `.env.local` currently holds a **specific dead tunnel** URL. `NEXT_PUBLIC_*` is **inlined at build time**, so the tunnel URL is *frozen into each Vercel build* — when the tunnel changes, the site must be **rebuilt/redeployed**.
- `HeroGlobe.tsx` fetches GeoJSON + reverse-geocode from public internet (GitHub raw, OpenStreetMap) — third-party runtime dependencies.

### 1.10 Why the frontend is not receiving data (root causes)
1. **Backend unreachable from the deployed site.** `NEXT_PUBLIC_API_URL` points at a `*.lhr.life` tunnel that is **down** (verified HTTP 503 / 000). Every `/status`, `/statistics`, `/alerts`, `/chains`, `/api/aria/chat` call fails → empty panels + "backend offline".
2. **The live build predates the fixes.** The deployed bundle still has the HeroGlobe crash, the exhausted hardcoded Gemini key, the white dropdown, etc. Local is fixed but **not redeployed**.
3. **Ephemeral-tunnel + build-time env mismatch.** Even when a tunnel is up, its URL changes on restart; because `NEXT_PUBLIC_*` is baked at build, the deployed site keeps calling the *old* tunnel until rebuilt.
4. **No data without capture.** Even with a reachable backend, the dashboards stay empty until either the **sniffer** runs (needs Npcap + Administrator) or **Demo Mode** is started.

---

## PHASE 2 — Backend / API analysis
See **`API_REQUIREMENTS_MAP.md`** for the full endpoint-by-endpoint table (path, method, body, response, status, consumer).

Highlights:
- Health/status: `GET /status`, `GET /` — **working**.
- Sniffer: `POST /toggle-sniffing` (toggle), `GET /interfaces` — **working**, but live capture needs admin+Npcap.
- Demo: `POST /api/sniffer/demo/start|stop` — **working** (safe synthetic data).
- ARIA: `POST /api/aria/chat` (SSE stream, Python backend, NVIDIA) — **working locally**.
- Data: `GET /alerts`, `GET /alerts/recent`, `GET /statistics`, `GET /chains` — **working**.
- Engines: `POST /api/engines/{engine}/run` (mace/aria/adrs/phantom/aegis/chronicle) — **working**.
- Chronicle: `POST /api/chronicle/{chain_id}` — **working**.
- Realtime: `WS /ws/alerts` — implemented; frontend currently **polls instead**.
- **Duplicate chatbot:** `POST /api/chat` (Next.js route, Gemini/Groq direct) — **orphaned**, not used by the UI; should be removed or unified.
- **CORS:** backend allows `*` (open) — fine for dev, tighten for prod.
- **Auth:** none. The API is unauthenticated.

---

## PHASE 3 — Current frontend analysis

### Keep (good)
- The **cyberpunk visual identity**: dark navy base, neon cyan/green/purple/red accents, Orbitron/Share-Tech-Mono fonts, scanline + vignette overlays, glassmorphism cards.
- **HeroGlobe** concept (attack arcs to the user's location), animated status badges, the engine-card aesthetic, chart styling (recharts).
- Recently added **StateMessage** (loading/empty/error/offline + retry), **Dropdown** (dark custom select), **Demo Mode** — keep these patterns.

### Broken / fixed-locally-but-not-deployed
- HeroGlobe crash (`globeMaterial()` not a function) — fixed locally.
- ARIA 429 (Gemini) — migrated to NVIDIA locally.
- White native dropdown — replaced locally.
- Empty panels with no error/retry — fixed locally with StateMessage.

### Redesign / restructure
- **One giant `page.tsx`** → split into an app-shell + route/section components.
- **Three API clients** → consolidate to one typed client with timeout/retry/error handling.
- **Per-component polling** → centralize via SWR or a WebSocket subscription.
- **All-inline styles** → move to Tailwind classes / CSS modules for maintainability and responsiveness.
- **Floating overlays** (ControlPanel/ChatPanel as fixed FABs) → consider a proper sidebar/drawer + dock on desktop, bottom-sheet on mobile.

### Remove
- `MetricsTable.tsx` (unused), `lib/api.ts` + `hooks/*` if consolidating, and the orphaned `app/api/chat/route.ts` (or repurpose as the single ARIA proxy).

### Componentize
- StatusBadge, StatCard, EngineCard, ChartCard, AlertRow, ChatWidget, SnifferControl, Dropdown, StateMessage, AppShell, Sidebar/Drawer.

---

## Cross-cutting recommendations
1. **One API client** (`lib/apiClient.ts`) with base URL, timeout, retry, typed errors.
2. **Stable backend URL** — prefer a fixed reverse proxy / Cloudflare Tunnel / deployed backend host over ephemeral `lhr.life`, OR a runtime config endpoint so the URL isn't build-time-frozen.
3. **Tighten CORS** to the Vercel origin in production.
4. **Keep all LLM keys backend-only.** Do not ship `GEMINI_API_KEY`/`GROQ_API_KEY` to Vercel for the orphaned `/api/chat`; route ARIA through the Python backend only.
5. **Initialize git** and adopt the branch/backup strategy in `LEGACY_FRONTEND_BACKUP_PLAN.md`.
