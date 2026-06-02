# STITCH_DESIGN_ANALYSIS.md

> **Note:** The Stitch MCP project `projects/995694748199355042` could not be fetched — no Stitch MCP
> server was connected to this environment. This analysis is derived from the authoritative design
> spec in `docs/FRONTEND_REDESIGN_REQUIREMENTS.md` (the document that drives the Stitch prompt), so it
> reflects the intended design. Replace/augment with real Stitch output once the MCP is connected.

## Concept
Autonomous XDR + AI threat-intelligence **command center** for SOC analysts. Tone: military-grade,
futuristic, calm under pressure. Dark cyberpunk base with neon accents and glassmorphism.

## Visual identity
- Deep navy/near-black base (`#040a14`), neon cyan/green/purple/orange/red accents (see DESIGN_TOKENS.md).
- Glassmorphism cards, scanline + CRT vignette, hex-grid texture, 3D globe hero.
- Fonts: Orbitron (display), Share Tech Mono (data), Inter (body).

## Screens
1. Command Center hero (3D globe + product title + system pulse)
2. Backend / API status panel
3. Control panel / sniffer controls (+ Demo Mode)
4. ARIA AI copilot (dock desktop / bottom sheet mobile)
5. XDR engine suite (MACE, ARIA, ADRS, PHANTOM, AEGIS, CHRONICLE)
6. Threat intelligence (distribution donut, protocol bars, alert timeline area, top vectors)
7. MACE attack chains (+ CHRONICLE report)
8. Live alerts stream (filterable, expandable)
9. Settings / configuration (+ legacy/new UI switch)
10. Legacy UI switch / route

## Build approach
- New UI isolated under `components/sentinel-v2/`; legacy preserved verbatim under `components/legacy/` + `/legacy` route.
- All data via one typed client (`lib/apiClient.ts`) with timeout/retry/typed errors and full loading/empty/error/offline states.
- See COMPONENT_MAP.md, RESPONSIVE_LAYOUT.md, ANIMATION_PLAN.md, DESIGN_TOKENS.md.
