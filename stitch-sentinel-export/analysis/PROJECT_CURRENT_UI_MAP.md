# Project Current UI Map

This document outlines the architecture, layout, routing, and api integration pattern of the original Next.js frontend, ensuring we safely integrate the new Stitch UI.

## 1. Environment & Framework Specifications

- **Framework**: Next.js v16.2.4 (React v19.2.4).
- **Router Pattern**: Next.js **App Router** (`/app` directory).
- **Styling**: TailwindCSS v4 with PostCSS (configured via `@tailwindcss/postcss`). Custom theme custom values and layout presets are defined in `app/globals.css`.
- **TypeScript**: Configured via `tsconfig.json`. Fully strictly typed layout.

## 2. File and Directory Structure

### App Routes (`/app`)
- [page.tsx](file:///c:/Users/obaiz/OneDrive/Desktop/AI-IDS-main/AI-IDS-main/sentinel-ui/app/page.tsx): The root route file. Imports both `LegacyDashboard` and `NewDashboard` and dynamically toggles rendering using `NEXT_PUBLIC_UI_VERSION`.
- [globals.css](file:///c:/Users/obaiz/OneDrive/Desktop/AI-IDS-main/AI-IDS-main/sentinel-ui/app/globals.css): Global Tailwind custom properties, custom colors, animations, and typography tokens.
- [layout.tsx](file:///c:/Users/obaiz/OneDrive/Desktop/AI-IDS-main/AI-IDS-main/sentinel-ui/app/layout.tsx): App root wrapper, providing fonts (Inter, Space Grotesk, Space Mono) and standard metadata.
- `/legacy`: Route folder with [page.tsx](file:///c:/Users/obaiz/OneDrive/Desktop/AI-IDS-main/AI-IDS-main/sentinel-ui/app/legacy/page.tsx) that always renders the legacy dashboard.
- `/new`: Route folder with [page.tsx](file:///c:/Users/obaiz/OneDrive/Desktop/AI-IDS-main/AI-IDS-main/sentinel-ui/app/new/page.tsx) that always renders the new dashboard.
- `/api`: Contains local Next API endpoints (e.g. proxying chat/data logs if necessary).

### Components (`/components`)
- `/components/legacy/`: Stores [LegacyDashboard.tsx](file:///c:/Users/obaiz/OneDrive/Desktop/AI-IDS-main/AI-IDS-main/sentinel-ui/components/legacy/LegacyDashboard.tsx) (verbatim copy of the original main page).
- `/components/sentinel-v2/`: Stores the new cyberpunk component files (`AppShell`, `SnifferControlPanel`, `ThreatIntelligenceDashboard`, etc.) and the stylesheet `sentinel-v2.css`.
- Original dashboard sub-components remain in `/components/`:
  - `StatusBar.tsx`, `AlertFeed.tsx`, `ThreatCharts.tsx`, `ControlPanel.tsx`, `ChatPanel.tsx`, `XDRPanel.tsx`, `XDREngines.tsx`, `HeroGlobe.tsx`, `FloatingObjects.tsx`, `DataStreams.tsx`.

### Data and API layer (`/lib`)
- [apiClient.ts](file:///c:/Users/obaiz/OneDrive/Desktop/AI-IDS-main/AI-IDS-main/sentinel-ui/lib/apiClient.ts): Unified API client with:
  - Base URL configuration (from `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_API_URL` falling back to `http://127.0.0.1:8000`).
  - Strict header additions (`ngrok-skip-browser-warning: true`).
  - Request timeouts (8s) and retries.
  - Typed results and error objects (`ApiError`).

## 3. Environment Variables (`/sentinel-ui/.env.local` / `.env.example`)
- `NEXT_PUBLIC_UI_VERSION`: Controls root page display. Values: `legacy` (default) or `new`.
- `NEXT_PUBLIC_API_BASE_URL`: Endpoint of the Python backend (FastAPI agent).
- `NEXT_PUBLIC_API_URL`: Fallback backend URL path.

## 4. API Endpoints Map
All components in the new UI map to the existing backend services:
- `/status` -> System Status counters, queues, and online indicators (`StatusPanel.tsx`).
- `/interfaces` -> List of active interfaces on the machine (`SnifferControlPanel.tsx`).
- `/toggle-sniffing` -> Toggle live sniffing on the agent (`SnifferControlPanel.tsx`).
- `/api/sniffer/demo/start` & `/api/sniffer/demo/stop` -> Controls synthetic packet capture (`SnifferControlPanel.tsx`).
- `/statistics` -> Threat severity, protocols, timeline, and vectors (`ThreatIntelligenceDashboard.tsx`).
- `/chains` -> Correlation graphs and threat tracking nodes (`MaceAttackChains.tsx`).
- `/api/chronicle/{chain_id}` -> Generate automated incident reports (`MaceAttackChains.tsx`).
- `/api/engines/{engine}/run` -> Runs individual cybersecurity analysis agents (`XDREngineSuite.tsx`).
- `/api/aria/chat` -> Streaming SSE AI response conversation (`AriaCopilot.tsx`).
- `/alerts` & `/alerts/recent` -> Search/Triage lists of parsed incidents (`LiveAlertsStream.tsx`).
