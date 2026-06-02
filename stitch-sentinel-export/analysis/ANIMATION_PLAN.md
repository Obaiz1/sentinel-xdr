# ANIMATION_PLAN.md

Lightweight, performance-friendly motion using **already-installed** deps (framer-motion, three/react-globe.gl, recharts) + CSS. No new heavy libraries added.

| Effect | Where | Tech |
|---|---|---|
| 3D hero globe + attack arcs | `CommandHero` (reuses `HeroGlobe`) | three.js / react-globe.gl |
| Radar sweep over hero | `CommandHero` | CSS conic-gradient `@keyframes sv-radar` |
| Floating telemetry particles | `NewDashboard` | CSS `@keyframes sv-stream` |
| Card 3D tilt on hover | `Card.tsx` | pointer-driven CSS `transform: perspective() rotateX/Y` (mouse only) |
| Card entrance fade/rise | `Card.tsx` | framer-motion `whileInView` |
| Neon pulse status dots | everywhere | CSS `@keyframes sv-pulse` (`.sv-pulse-dot`) |
| ARIA avatar status ring | `AriaCopilot` | CSS `@keyframes sv-spin` (`.sv-aria-ring`) |
| ARIA panel / drawer in-out | `AriaCopilot`, `AppShell` | framer-motion `AnimatePresence` |
| Alert row expand | `LiveAlertsStream` | framer-motion height auto |
| Chart entry animation | `ThreatIntelligenceDashboard` | recharts built-in |

**Accessibility / performance**
- `@media (prefers-reduced-motion: reduce)` disables pulse, ring, particles, radar, and tilt transitions.
- 3D tilt only fires for `pointerType === "mouse"` (no jank on touch).
- No layout-thrashing infinite animations on mobile-critical paths; animations never block interaction.
