# RESPONSIVE_LAYOUT.md

Breakpoints implemented in `sentinel-ui/components/sentinel-v2/sentinel-v2.css`.

| Width | Layout |
|---|---|
| ≥1024px (desktop / 1440) | Persistent left sidebar (248px) + content grid. Engine cards 3-col, charts/chains 2-col. ARIA docked bottom-right. |
| 768–1023px (tablet) | Sidebar persists; engine cards 2-col; charts/chains 2-col. |
| ≤767px (mobile / 390 / 430) | Sidebar → hamburger drawer. All grids single-column. ARIA → full-width bottom sheet. Header status pill hidden (`.sv-hide-mobile`). |

Guarantees:
- `html, body { overflow-x: hidden }` (globals.css) + `.sv-content { min-width: 0 }` prevent horizontal scroll at every width.
- Buttons / nav / filter chips ≥ 40px tap targets (chips ≥ 32px).
- Headings use `clamp()`; status badges wrap; cards stack.
- Interface dropdown is a custom dark listbox contained inside its card (no white native popup).
- Charts use recharts `ResponsiveContainer` (fluid width, fixed 200px height).

Test widths called out by the plan: **390 / 430 / 768 / 1024 / 1440 px** — all single-column ≤767, 2-col 768–1023, full grid ≥1024.
