# SENTINEL XDR — Screenshot → Component Map (Phase 2)

Maps each exported screenshot to the React component that renders it. All components live in
`sentinel-ui/components/sentinel-v2/`. **(existing)** = already built by prior session,
**(new)** = added in this pass.

| Screenshot(s) | UI section | Component | Status |
|---|---|---|---|
| 14, 32 | Logo (full + compact) | `SentinelLogo.tsx` | existing |
| — (shell) | App frame: header, sidebar, mobile drawer | `AppShell.tsx` | existing |
| 03,05,06,08,11,27,34 | Command Center hero + KPIs | `CommandHero.tsx` + `HeroGlobe` | existing |
| 03 (status row) | Backend / API status | `StatusPanel.tsx` | existing |
| (control) | Sniffer / demo controls | `SnifferControlPanel.tsx` | existing |
| 12,18,31 | XDR Engine Suite | `XDREngineSuite.tsx` | existing |
| 19,20 | Threat Intelligence charts | `ThreatIntelligenceDashboard.tsx` | existing |
| 02,04,21 | MACE attack chains | `MaceAttackChains.tsx` | existing |
| 09,23 | Live alerts stream | `LiveAlertsStream.tsx` | existing |
| 17,22 | ARIA Copilot | `AriaCopilot.tsx` | existing |
| 25,33 | Settings + Legacy switch | `SettingsPanel.tsx` | existing |
| 13 | Executive Overview | `ExecutiveOverview.tsx` | **new** |
| 10,26,28,29 | Incident Management / War Room | `IncidentManagement.tsx` | **new** |
| 24 | Forensics Investigation Lab | `ForensicsInvestigation.tsx` | **new** |
| 01,07,15,16 | Network Topology HUD | `NetworkTopologyHUD.tsx` | **new** |
| 30 | Vulnerability Management | `VulnerabilityManagement.tsx` | **new** |
| (all) | Loading/empty/error/offline | `StateMessage.tsx` | existing |
| (all data) | Polling + state derivation | `usePolling.ts` | existing |
| (all cards) | Glass card + 3D tilt | `Card.tsx` | existing |

## Shared infrastructure (reused, not duplicated)
- `lib/apiClient.ts` — typed API client (timeout, retry, offline/http/timeout/parse errors, `ngrok-skip-browser-warning`, `streamAriaChat`).
- `components/sentinel-v2/sentinel-v2.css` — scoped `sv-*` styling + responsive + reduced-motion.
- Routing: `app/page.tsx` (root switch via `NEXT_PUBLIC_UI_VERSION`), `app/new/page.tsx`, `app/legacy/page.tsx`.

## Composition
`NewDashboard.tsx` assembles all sections in order with `<Section>` headers and registers nav ids
in `AppShell.tsx` `NAV`. New screens are inserted as their own scroll sections with matching nav entries.
