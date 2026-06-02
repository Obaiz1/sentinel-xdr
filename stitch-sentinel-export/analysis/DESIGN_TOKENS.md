# DESIGN_TOKENS.md — SENTINEL XDR Command Center

Tokens are defined in `sentinel-ui/app/globals.css` (`:root`) and consumed by both legacy and new UI.

## Colors
| Token | Value | Meaning |
|---|---|---|
| `--neon-blue` | `#00d4ff` | primary / info |
| `--neon-green` | `#00ff88` | healthy / active / low |
| `--neon-purple` | `#a855f7` | AI / medium |
| `--neon-orange` | `#ff9900` | warning / high |
| `--neon-red` | `#ff3366` | critical / error / offline |
| `--neon-yellow` | `#ffd700` | accent |
| `--bg-deep` | `#040a14` | app background |
| `--bg-card` | `rgba(6,15,32,0.85)` | glass card fill |
| `--text-primary` | `#e2e8f0` | body text |
| `--text-muted` | `#4a6080` | labels / secondary |

## Typography
- Display / headings: **Orbitron** (`--font-display`)
- Mono / labels / data: **Share Tech Mono** (`--font-mono`)
- Body: **Inter** (`--font-inter`)
- Headings use `clamp()` for fluid sizing.

## Spacing / radius
- Card radius: 16px (new), 14px (legacy glass-card)
- Grid gap: `clamp(12px, 2vw, 20px)` (`--sv-gap`)
- Sidebar width: 248px; header height: 60px
- Min tap target: 40px (`.sv-btn`, nav, filter chips)

## Surfaces / effects
- Glassmorphism: translucent fill + `backdrop-filter: blur(16px)` + 1px neon-tinted border + soft outer glow on hover.
- Scanline + CRT vignette overlays (globals.css `body::before/::after`).
- Hex-grid + dual radial glow backdrop (`.sv-bg`).
