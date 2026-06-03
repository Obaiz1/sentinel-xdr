# SENTINEL XDR — Screenshot UI Analysis (Phase 2)

Source: `stitch-exports/SENTINEL-XDR/` (34 exported Stitch PNGs).
Analyzed against the existing Next.js UI in `sentinel-ui/components/sentinel-v2/`.

## Global design language (consistent across all 34)

- **Theme:** dark cyberpunk SOC / XDR command-center. Near-black navy base (`#040a14` / `#050c1a`), glassmorphism panels with blurred translucent fills and 1px neon borders.
- **Neon palette:** cyan `#00d4ff` (primary/UI), green `#00ff88` (healthy/active), purple `#a855f7` (AI/ARIA), orange `#ff9900` (warning/threat-intel), red `#ff3366` (critical/breach), gold `#ffd700` (accents).
- **Typography:** mono for data/telemetry, a wide-tracked display face for section labels/headings, sans for body.
- **Layout pattern:** sticky top header (logo + status pills + global search) · left vertical nav rail · main scroll content · right ARIA Copilot column (becomes a dock/bottom-sheet on smaller screens).
- **3D / motion implied:** animated hex/radial grid backdrop, floating telemetry particles, radar sweep, rotating cyber globe/orb, glowing attack arcs, pulsing status dots, card hover-tilt (perspective), chart entrance animations, streaming log/alert rows, neural-core ARIA avatar.
- **States:** every data panel shows live/empty/loading variants; "breach/DDoS" variants recolor the same layout toward red and raise counters.

---

## Per-screenshot breakdown

> Many screenshots are **state variants** of the same screen (baseline → breach/DDoS → post-breach). They are grouped; the layout is identical, only colors/counters/labels change.

### Command Center Dashboard — `03, 05, 06, 08, 11, 27, 34`
- **Screen:** main overview / hero.
- **Layout:** header (logo, `SYSTEM LIVE`, time) · left nav (Command Center, Control Panel, ARIA Copilot, XDR Engines, Threat Intelligence, MACE Chains, Live Alerts, Settings, Legacy UI) · center network-globe HUD with `SYS-MONITORING: ACTIVE` + `INTERCEPT ORIGIN: LAHORE, PK` callout · 6 KPI stat cards (Packets Captured, Critical Threats, AI Analyzed, Alerts Detected, Active Chains, Queue Load) · right ARIA Copilot stream.
- **Components:** stat cards, 3D globe/topology, ARIA chat, bottom `INITIATE SCAN`.
- **3D/anim:** rotating globe, node pulses, particle field, KPI count-up, ARIA typing.
- **Variants:** `06` = "3D Motion Edition" (heavier animation); `11` DDoS, `27` breach-in-progress, `34` post-breach stabilization (red→green recovery).
- **Backend:** `/status`, `/statistics`, `/alerts`, `/chains`, `/api/aria/chat`.

### Network Topology HUD — `01, 07, 15, 16`
- **Screen:** asset/topology map.
- **Layout:** left **Asset Map** node tree (e.g. `DB-REPLICA STAT: SECURE`, `APP-SRV-X IP/STAT`, `DB-PROD-A`, External Node) · center scrolling event log · **LIVE TELEMETRY** counters (Active Threats, Nodes, Compromised, Packet Drop) · right ARIA Neural Link.
- **3D/anim:** connecting edges, animated packet flow, node status colors, log stream.
- **Variants:** `07` edge saturation, `15` tactical, `16` data-exfil detected (red exfil arc).
- **Backend:** nodes/edges derivable from `/statistics` (`top_sources`) + `/alerts` (src/dst IPs); telemetry from `/status` + `/statistics`. No dedicated topology API.

### MACE Attack Chains — `02, 04, 21`
- **Screen:** multi-stage attack correlation.
- **Layout:** chain cards with chain_id, actor, **score**, kill-chain phase tags, attacker intent, `Generate CHRONICLE Report`.
- **3D/anim:** chain-link arcs, score glow, phase tag highlight.
- **Backend:** `GET /chains`, `POST /api/chronicle/{chain_id}`. ✅ fully supported.

### XDR Engine Suite — `12, 18, 31`
- **Screen:** engine control grid.
- **Layout:** cards for MACE / ARIA / ADRS / PHANTOM (and AEGIS/CHRONICLE) with status badge (IDLE/THINKING/STANDBY/DEPLOYED), description, mini activity bars, `RUN`/`STOP`/`CONFIGURE` · right Neural Insights live stream.
- **3D/anim:** animated equalizer bars, status pulse, run feedback.
- **Variants:** `12` packet-storm mitigation, `31` tactical.
- **Backend:** `POST /api/engines/{engine}/run` (mace/aria/adrs/phantom/aegis/chronicle). ✅ supported.

### Threat Intelligence Dashboard — `19, 20`
- **Screen:** analytics charts.
- **Layout:** 2×2 chart grid — Threat Distribution (donut), Protocol Breakdown (bars), Alert Timeline (area), Top Attack Vectors (horizontal bars).
- **3D/anim:** chart entrance, tooltip glow.
- **Backend:** `GET /statistics`. ✅ supported.

### Live Alerts Stream — `09, 23`
- **Screen:** real-time alert feed.
- **Layout:** severity filter chips (All/Critical/High/Medium/Low), expandable alert rows (level badge · vector · src→dst · confidence · time → MITRE, ports, flags, explanation, recommended action).
- **3D/anim:** row stream-in, expand/collapse, severity glow.
- **Backend:** `GET /alerts` (+ `/alerts/recent`). ✅ supported.

### ARIA Copilot — `17, 22`
- **Screen:** AI assistant.
- **Layout:** neural-core avatar, chat bubbles, suggested actions (e.g. "Isolate traffic"), command input "Query telemetry, analyse".
- **3D/anim:** spinning neural ring, typing stream, glow.
- **Variants:** `17` autonomous mitigation/containment, `22` neural-link tactical.
- **Backend:** `POST /api/aria/chat` (streamed) **only** — no direct LLM calls from frontend. ✅ supported.

### Executive Overview — `13`
- **Screen:** leadership summary.
- **Layout:** "Executive Overview" title + `GLOBAL INFRASTRUCTURE STATUS: NOMINAL` · **Security Posture Score** radial gauge (85/100) with Readiness + Risk Exposure bars · **Active Threats** list (APT-29 SEV1, Anomalous Login SEV3, `VIEW ALL INCIDENTS`) · **Risk Mitigation & ROI Impact** bar chart · `EXPORT BRIEF` / `ENTER DEFCON`.
- **Backend:** **derived** from `/statistics` (posture/severity mix), `/alerts` (active threats), `/chains`. Posture score is a transparent heuristic, labeled as derived. No dedicated "posture/ROI" API.

### Incident Management / War Room — `10, 26, 28, 29`
- **Screen:** incident queue + war room.
- **Layout:** `MEAN TIME TO RESOLVE` timer · `ACTIVE THREAT MATRIX` heat grid · `CRITICAL TICKET QUEUE` (INC-#### tickets with severity badges) · right **WAR ROOM** status + command console.
- **Variants:** `10` tactical, `28` DDoS mitigation, `29` war room.
- **Backend:** **derived** — incidents = correlated `/chains` + grouped critical `/alerts`; matrix from `/statistics`; CHRONICLE report per incident. No dedicated ticketing API → ticket IDs are synthesized from real chain/alert IDs (not fabricated data). War-room free-text command routes to ARIA (`/api/aria/chat`); if unused, shown idle, never faked.

### Forensics Investigation Lab — `24`
- **Screen:** deep-dive forensics.
- **Layout:** `ACTIVE SESSION` header · **Bit-Stream Analyzer** (hex dump) · **ARIA Copilot** signature match · **Timeline Reconstruction** (Initial Access → Payload Drop → Memory Inject → C2 Beacon) · `EXPORT REPORT`.
- **Backend:** **partially derived** — alert detail via `GET /alerts/{id}` (structured packet fields: src/dst/ports/flags/protocol/MITRE/explanation), timeline from chain `kill_chain_phases`, narrative from CHRONICLE. ⚠️ **Raw hex bit-stream is NOT exposed by backend** (structured telemetry only) → that sub-panel is shown as a clear "Raw byte stream not available — structured telemetry only" disabled state, not faked.

### Vulnerability Management — `30`
- **Screen:** vuln/exposure.
- **Layout:** `GLOBAL THREAT SURFACE` scatter map · `SEVERITY DIST` donut (142 total, Critical/High/Med %) · Copilot Insight · **PRIORITIZED CVE QUEUE** table (CVE id, asset, CVSS, remediation status) · `EXPORT LOG`.
- **Backend:** **partially derived** — attack surface + severity distribution from `/statistics` (`top_sources`, `top_attack_vectors`, `threat_distribution`). ⚠️ **No CVE/vulnerability scanner backend** → the CVE queue is rendered as a clear "Not connected / Backend not available" disabled panel, **not** populated with fabricated CVEs.

### Settings / Configuration & Legacy Switch — `25, 33`
- **Screen:** settings + UI version control.
- **Layout (`33`):** `SYSTEM ENVIRONMENT NOTICE` · `CURRENT STATE: NEW UI ACTIVE` + uptime · Active Subsystems vs Legacy Modules lists · `ROLLBACK TO LEGACY UI` button · sys/terminal footer.
- **Backend:** none required — reads `NEXT_PUBLIC_UI_VERSION`, `API_BASE_URL`; links `/legacy` `/new`. ✅ supported (local UI prefs only).

### Branding — `14` (Full Logo), `32` (Compact Icon)
- **Screen:** logo lockups.
- **Elements:** 3D cyber shield + futuristic **S** monogram + AI eye/neural core, circuit lines, cyan border, purple core, green pulse dot.
- **Backend:** none. Implemented as `SentinelLogo.tsx` (full + compact variants).

---

## Summary — screens vs backend support

| Screen | Screenshots | Backend support |
|---|---|---|
| Command Center | 03,05,06,08,11,27,34 | ✅ direct |
| Network Topology HUD | 01,07,15,16 | ◐ derived from telemetry |
| MACE Chains | 02,04,21 | ✅ direct |
| XDR Engine Suite | 12,18,31 | ✅ direct |
| Threat Intelligence | 19,20 | ✅ direct |
| Live Alerts | 09,23 | ✅ direct |
| ARIA Copilot | 17,22 | ✅ direct |
| Executive Overview | 13 | ◐ derived |
| Incident / War Room | 10,26,28,29 | ◐ derived |
| Forensics Lab | 24 | ◐ derived (raw hex ✗ disabled) |
| Vulnerability Mgmt | 30 | ◐ derived (CVE queue ✗ disabled) |
| Settings / Legacy switch | 25,33 | ✅ local prefs |
| Branding | 14,32 | n/a |

✅ direct = backed by an existing API · ◐ derived = built from existing telemetry, no new API invented · ✗ = no data, rendered as a clear disabled "Not connected" state (never faked).
