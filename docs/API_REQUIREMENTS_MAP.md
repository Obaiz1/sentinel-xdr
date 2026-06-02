# API_REQUIREMENTS_MAP.md
**SENTINEL XDR / AI-IDS — Backend API Map & Frontend Consumption**

Base URL (frontend): `process.env.NEXT_PUBLIC_API_URL` (fallback `http://127.0.0.1:8000`).
All requests should send header `ngrok-skip-browser-warning: true` (harmless on non-tunnel hosts).
Auth: **none** (unauthenticated API). CORS: currently `*`.

Status legend: ✅ working · 🟡 works but needs improvement · 🔴 broken/blocked · 🟣 duplicate/orphaned

---

## System / health

| Endpoint | Method | Request | Response (shape) | Status | Frontend consumer |
|---|---|---|---|---|---|
| `/` | GET | — | `{name, version, status, endpoints}` | ✅ | (none / smoke test) |
| `/status` | GET | — | `{system, sniffer, demo, triage, llm_analyzer, rag_engine, queues, database}` | ✅ | **StatusBar** (badges + PKT/FLAGGED/ANALYZED), **ControlPanel** (queues, demo/sniffer state), **API Status panel** |
| `/interfaces` | GET | — | `{interfaces:string[], current, count}` | 🟡 returns 45 raw `\Device\NPF_{…}` names | **ControlPanel** interface dropdown (needs friendly labels) |

## Sniffer / capture

| Endpoint | Method | Request | Response | Status | Consumer |
|---|---|---|---|---|---|
| `/toggle-sniffing` | POST | `{interface?, bpf_filter?}` | `{action:"started"|"stopped", message, session_id?, stats?}` | 🟡 toggles (not explicit start/stop); live capture needs **Npcap + Administrator** | **ControlPanel** Start/Stop |
| `/api/sniffer/demo/start` | POST | `{}` | `{action:"demo_started", demo:{running, generated}}` | ✅ safe synthetic events (no capture) | **ControlPanel** Demo button |
| `/api/sniffer/demo/stop` | POST | `{}` | `{action:"demo_stopped", demo}` | ✅ | **ControlPanel** Demo button |

> **Redesign note:** expose/derive explicit **start** and **stop** in the client (the backend toggles based on current `is_running`). Surface sniffer states: `idle / starting / running / stopping / error / admin-required`.

## Alerts

| Endpoint | Method | Request | Response | Status | Consumer |
|---|---|---|---|---|---|
| `/alerts` | GET | query `limit, offset, level?, status?` | `{alerts:Alert[], pagination, filters}` | ✅ | **AlertFeed** (Live Alert Stream) |
| `/alerts/recent` | GET | — | `{alerts:Alert[], count}` (in-memory buffer) | ✅ | fast live feed / WS fallback |
| `/alerts/{id}` | GET | — | `Alert` | ✅ | alert detail expansion |

`Alert` = `{id, timestamp, src_ip, dst_ip, src_port?, dst_port?, protocol, tcp_flags?, triage_flags?, threat_level, confidence?, attack_vector?, mitre_technique?, explanation?, recommended_action?, status}`

## Analytics

| Endpoint | Method | Request | Response | Status | Consumer |
|---|---|---|---|---|---|
| `/statistics` | GET | — | `{threat_distribution[], top_sources[], protocol_breakdown[], threat_timeline[], top_attack_vectors[], counts, real_time}` | ✅ | **ThreatCharts**: Threat Distribution (donut), Protocol Breakdown (bar), Alert Timeline (area), Top Attack Vectors (bars) |

> The four "empty" panels (Threat Distribution / Protocol Breakdown / Alert Timeline / Top Attack Vectors) are all driven by **`/statistics`**. They are empty only because (a) the backend is unreachable on the live site, and/or (b) no capture/demo data exists yet.

## MACE / XDR engines

| Endpoint | Method | Request | Response | Status | Consumer |
|---|---|---|---|---|---|
| `/chains` | GET | — | `{chains:Chain[]}` (active attack chains) | ✅ | **XDRPanel** (MACE active chains) |
| `/api/engines/{engine}/run` | POST | `{}` (engine ∈ mace,aria,adrs,phantom,aegis,chronicle) | `{engine, status, title, summary, metrics, items[], timestamp}` | ✅ | **XDREngines** cards (Run + result panel) |
| `/api/chronicle/{chain_id}` | POST | `{}` | `{report_id, chain_id, actor_id, executive_summary, technical_details, generated_at}` | ✅ (LLM) | **XDRPanel** "Generate CHRONICLE Report" |

`Chain` = `{chain_id, actor_id, chain_score, kill_chain_phases(JSON), mitre_techniques(JSON), first_seen, last_seen, status, attacker_intent, ai_confidence}`

> **ADRS safety:** the live MACE pipeline can fire **real Windows firewall rules** (`response.py`, `simulated=False`). The `/api/engines/adrs/run` endpoint is a **non-destructive dry-run** by design and must stay that way.

## ARIA chatbot

| Endpoint | Method | Request | Response | Status | Consumer |
|---|---|---|---|---|---|
| `/api/aria/chat` | POST | `{message, history:[{role,content}]}` | **text/plain SSE stream** (chunked) | ✅ (NVIDIA primary, Gemini/Groq fallback, all backend-only) | **ChatPanel** (ARIA Copilot) |
| `/api/chat` (Next.js route) | POST | `{message, context, history}` | JSON (Gemini/Groq **direct from Next server**) | 🟣 **orphaned duplicate** — not used by UI; needs Vercel-side keys; remove or unify | — |

## Realtime

| Endpoint | Method | Notes | Status | Consumer |
|---|---|---|---|---|
| `/ws/alerts` | WS | pushes new alerts from the in-memory buffer | 🟡 implemented but **frontend polls instead** | future **Live Alert Stream** (replace polling) |

---

## Integration requirements for the new frontend
- **Single typed client** with `baseUrl`, `timeout` (e.g. 8 s), `retry` (1–2), and typed errors → distinguishes **offline** vs **empty** vs **error**.
- **Polling cadence:** `/status` 3 s, `/alerts` 2–3 s, `/statistics` 5 s, `/chains` 6 s — OR subscribe to `/ws/alerts` for the stream and poll the rest.
- **Never** call LLMs from the browser; ARIA goes through `/api/aria/chat` only. Keep `GEMINI/GROQ/NVIDIA` keys server-side.
- **Friendly interface labels** for `/interfaces` (map `\Device\NPF_{GUID}` → `Adapter <8 hex>`, keep raw value as the option value / tooltip).
- **Empty-state guidance:** when arrays are empty, prompt "Start Demo Mode or the sniffer" rather than spinning forever.
