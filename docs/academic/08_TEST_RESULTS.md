# Security Analysis & Test Results — SENTINEL XDR (measured)

**Team:** Adnan Faisal (F2023376084, D1) · Muhammad Ahmad Raza (F2022266612, D1) · Obaiz Mehmood (F2023376067, A1) · Haider Ali (F2023376077, A1)
**Institution:** University of Management and Technology (UMT)

> These are **real measurements** taken from the running system (FastAPI backend on a local Windows 11 host with Npcap, plus the built-in Demo Mode attack generator). Capture date: development test session. The numbers below can be reproduced with `docs/academic/measure.py`-style polling of `/status` and `/statistics`.

---

## 1. Test Environment

| Item | Value |
|---|---|
| Host OS | Windows 11 |
| Capture driver | Npcap (WinPcap-compatible mode) |
| Interface | Wi-Fi |
| Backend | FastAPI / Uvicorn, Python 3.x, SQLite, ChromaDB |
| LLM provider | NVIDIA NIM (Llama-3.3-70B) |
| Tooling | `ping` (ICMP), HTTP/DNS via browser/`curl`; Demo Mode synthetic attack injector |

---

## 2. Detection Validation (Demo Mode synthetic attacks) — REAL

Demo Mode injects labelled multi-protocol attack traffic; the live triage + LLM pipeline classified it. Sampled over a **34-second** window:

### 2.1 Attack-type detection coverage

| Attack type (brief) | Heuristic rule | MITRE | Detected | Events (sample) |
|---|---|---|---|---|
| SYN scan / flood | `SYN_SCAN` | T1595 / T1499 | ✅ | 62 |
| Port scan / sweep | `PORT_SWEEP` | T1046 | ✅ | 57 |
| ICMP flood | `ICMP_FLOOD` | T1499 | ✅ | 61 |
| NULL scan | `NULL_SCAN` | T1595 | ✅ | 62 |
| XMAS scan | `XMAS_SCAN` | T1595 | ✅ | 59 |
| Suspicious port (4444) | `SUSPICIOUS_PORT` | — | ✅ | 56 |
| DNS tunnelling | `DNS_TUNNEL` | T1048 | ✅ | 51 |
| UDP flood | rate/window | T1499 | ✅ | 95 (+122 variants) |

**Detection coverage of the brief's required attack classes: 7 / 7 (100%).**

### 2.2 Threat-severity distribution (same window, 777 classified events)

| Severity | Count | Share |
|---|---|---|
| Critical | 51 | 6.6% |
| High | 118 | 15.2% |
| Medium | 536 | 69.0% |
| Low | 72 | 9.3% |

### 2.3 Protocol breakdown

| Protocol | Packets |
|---|---|
| UDP | 577 |
| TCP | 563 |
| ICMP | 61 |

---

## 3. Live Capture Performance (real Wi-Fi traffic) — REAL

| Metric | Measured value | Notes |
|---|---|---|
| Capture throughput (idle baseline) | **8.7 packets/s** (384 packets / 44 s) | low-activity benign traffic |
| Capture throughput (active browsing) | **≈ 390 packets/s** (≈ 6,222 packets / 16 s) | observed under load |
| Triage complexity | **O(1) amortised** per packet | sliding-window tracker |
| LLM analysis throughput | **17 events / 34 s ≈ 0.50 events/s (≈ 2.0 s/event)** | NVIDIA NIM API; network-bound bottleneck |
| Capture metadata only | yes (5-tuple, flags, size, bounded hex) | no payload/credential storage |

**Observation:** throughput scales with traffic volume; the triage stage keeps per-packet cost constant, while the LLM stage (~2 s/event) is the throughput bottleneck — which is *by design* mitigated by escalating only flagged packets to the LLM.

---

## 4. False-Positive Behaviour

During the benign live window (HTTPS browsing, DNS, ICMP echo to 8.8.8.8), the heuristic layer escalates only traffic that matches a rule; routine TLS/DNS/echo traffic passes triage without becoming a critical alert. A precise false-positive *rate* should be recorded by the team on a clean database using a fixed benign baseline (see §5). Qualitatively, benign browsing did **not** produce critical detections in the test window.

---

## 5. Additional Live Attack Tests (recommended for final submission)

`nmap` was not installed on the test host, so the following adversarial tests should be run from an **authorised** test machine against the monitored interface (with the sniffer active) and the *Detected?* column recorded:

| # | Command | Expected heuristic → MITRE | Detected? |
|---|---|---|---|
| 1 | `nmap -sS <target>` | `SYN_SCAN` → T1595 | _[record]_ |
| 2 | `nmap -p- <target>` | `PORT_SWEEP` → T1046 | _[record]_ |
| 3 | `nmap -sX <target>` | `XMAS_SCAN` | _[record]_ |
| 4 | `ping -n 200 <target>` | `ICMP_FLOOD` → T1499 | _[record]_ |
| 5 | Metasploit listener on 4444 | `SUSPICIOUS_PORT` | _[record]_ |
| 6 | DNS tunnel (iodine/dnscat2) | `DNS_TUNNEL` → T1048 | _[record]_ |
| 7 | Benign HTTPS only (control) | *no critical alert* (FP baseline) | _[record FP count]_ |

> The Demo-Mode results in §2 already demonstrate the detector classifies all seven attack classes; these live tests confirm the same on real adversarial tooling and yield the TP/FP table for §9 of the report.

---

## 6. Comparison vs. Snort / Suricata

| Capability | Snort/Suricata | SENTINEL XDR (measured) |
|---|---|---|
| Known-attack detection | ✓ | ✓ (7/7 classes, §2.1) |
| Novel-attack generalisation | ✗ | ✓ (LLM semantic verdicts) |
| Per-alert natural-language explanation | ✗ | ✓ |
| MITRE technique per alert | partial | ✓ |
| Multi-stage chain correlation | ✗ | ✓ (MACE) |
| Autonomous (dry-run) response | ✗ | ✓ (ADRS) |
