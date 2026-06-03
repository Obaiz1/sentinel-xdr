# SENTINEL XDR — Backend Feature Map (Phase 3)

Source of truth = route decorators in `AI-IDS-main/main.py`. **No backend Python was modified.**
No APIs were invented; no button hard-codes success.

## Existing backend routes (verified in `main.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/status` | system/sniffer/llm/rag/db/demo/queue status |
| GET | `/interfaces` | capture interfaces |
| POST | `/toggle-sniffing` | start/stop live capture |
| POST | `/api/sniffer/demo/start` · `/stop` | demo telemetry generator |
| GET | `/alerts` | paginated alerts (limit/offset/level/status) |
| GET | `/alerts/recent` | in-memory recent alerts |
| GET | `/alerts/{id}` | single alert detail |
| GET | `/statistics` | threat_distribution, protocol_breakdown, threat_timeline, top_attack_vectors, top_sources, real_time |
| GET | `/chains` | MACE correlated attack chains |
| POST | `/api/chronicle/{chain_id}` | CHRONICLE narrative report |
| POST | `/api/engines/{engine}/run` | run mace/aria/adrs/phantom/aegis/chronicle |
| POST | `/api/aria/chat` | ARIA chat (streamed; backend handles LLM + provider fallback) |
| WS | `/ws/alerts` | live alert socket |

## Feature → API matrix

| Feature | Backend API | Exists? | Working? | If no API | Component |
|---|---|---|---|---|---|
| Backend/system status | `/status` | ✅ | ✅ | — | `StatusPanel` |
| Interface selection | `/interfaces` | ✅ | ✅ | — | `SnifferControlPanel` |
| Start/stop sniffer | `/toggle-sniffing` | ✅ | ✅ (needs admin/Npcap) | — | `SnifferControlPanel` |
| Demo mode | `/api/sniffer/demo/{start,stop}` | ✅ | ✅ | — | `SnifferControlPanel` |
| KPI stat cards | `/status` + `/statistics` | ✅ | ✅ | — | `CommandHero` |
| Threat charts | `/statistics` | ✅ | ✅ | — | `ThreatIntelligenceDashboard` |
| Live alerts + detail | `/alerts`, `/alerts/{id}` | ✅ | ✅ | — | `LiveAlertsStream`, `ForensicsInvestigation` |
| MACE chains | `/chains` | ✅ | ✅ | — | `MaceAttackChains`, `IncidentManagement` |
| CHRONICLE report | `/api/chronicle/{id}` | ✅ | ✅ | — | `MaceAttackChains`, `ForensicsInvestigation` |
| XDR engine run | `/api/engines/{engine}/run` | ✅ | ✅ | — | `XDREngineSuite` |
| ARIA chat | `/api/aria/chat` | ✅ | ✅ (stream) | — | `AriaCopilot` |
| Executive posture/ROI | — | ❌ | ◐ derived | computed transparently from `/statistics`+`/alerts`+`/chains`, labeled "derived" | `ExecutiveOverview` |
| Incident queue / MTTR / matrix | — | ❌ | ◐ derived | synthesized from real `/chains`+`/alerts` ids; MTTR/matrix from `/statistics` | `IncidentManagement` |
| War-room command console | `/api/aria/chat` | ✅ | ✅ (routes to ARIA) | — | `IncidentManagement` |
| Network topology nodes/edges | — | ❌ | ◐ derived | from `/statistics.top_sources`+`/alerts` src/dst | `NetworkTopologyHUD` |
| Forensics structured detail + timeline | `/alerts/{id}`, `/chains`, `/api/chronicle/{id}` | ✅ | ✅ | — | `ForensicsInvestigation` |
| Forensics raw hex bit-stream | — | ❌ | ✗ disabled | backend exposes structured telemetry only → "Raw byte stream not available" state | `ForensicsInvestigation` |
| Vuln attack surface + severity dist | `/statistics` | ✅ | ◐ derived | from `top_sources`/`top_attack_vectors`/`threat_distribution` | `VulnerabilityManagement` |
| Vuln CVE scanner / CVE queue | — | ❌ | ✗ disabled | no CVE/scan backend → "Not connected / Backend not available" panel | `VulnerabilityManagement` |
| UI version switch / legacy link | none (env) | ✅ | ✅ | local pref only | `SettingsPanel` |

## Rules honored
- ✅ derived features use **only existing telemetry**; aggregations are clearly labeled and never fabricate records.
- ✗ disabled features render an explicit "Not connected / Backend not available" state — no fake success, no placeholder rows.
- ARIA never calls an LLM from the browser — only `/api/aria/chat`.
- No API keys in the frontend. Backend Python untouched.
