# COMPONENT_MAP.md — new UI → files → backend

All new components live in `sentinel-ui/components/sentinel-v2/`. Data flows through `sentinel-ui/lib/apiClient.ts`.

| Screen / section | Component | Backend endpoint(s) | States |
|---|---|---|---|
| App shell (header + sidebar + mobile drawer) | `AppShell.tsx` | — | scroll-spy nav |
| Command hero (3D globe) | `CommandHero.tsx` (reuses `HeroGlobe`) | — | — |
| Backend / API status | `StatusPanel.tsx` | `GET /status` (3s) | loading/offline/data |
| Sniffer control | `SnifferControlPanel.tsx` | `GET /status`, `GET /interfaces`, `POST /toggle-sniffing`, `POST /api/sniffer/demo/start|stop` | idle/starting/running/stopping/error/offline/admin-required |
| ARIA copilot | `AriaCopilot.tsx` | `POST /api/aria/chat` (SSE stream) | streaming/offline/error |
| XDR engine suite | `XDREngineSuite.tsx` | `POST /api/engines/{engine}/run` | idle/running/result/error |
| Threat intelligence | `ThreatIntelligenceDashboard.tsx` | `GET /statistics` (5s) | loading/empty/data/offline |
| MACE attack chains | `MaceAttackChains.tsx` | `GET /chains` (6s), `POST /api/chronicle/{chain_id}` | loading/empty/data/offline |
| Live alerts stream | `LiveAlertsStream.tsx` | `GET /alerts?limit=50` (3s) | loading/empty/data/offline + filter |
| Settings / UI switch | `SettingsPanel.tsx` | reads `API_BASE_URL`, `NEXT_PUBLIC_UI_VERSION` | links to /legacy, /new |
| Logo | `SentinelLogo.tsx` | — | full / compact |
| Shared primitives | `Card.tsx` (3D tilt), `StateMessage.tsx`, `usePolling.ts` | — | — |

Routing:
- `app/page.tsx` → switch on `NEXT_PUBLIC_UI_VERSION` (default `legacy`).
- `app/legacy/page.tsx` → `components/legacy/LegacyDashboard.tsx` (original UI, unchanged).
- `app/new/page.tsx` → `NewDashboard.tsx`.
