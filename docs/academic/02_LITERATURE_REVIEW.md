# Literature Review — SENTINEL XDR: An LLM-Augmented Intrusion Detection System

**Course:** Information Security (Category A — AI & LLM-Powered Security Systems)
**Instructor:** Muhammad Zunnurain Hussain
**Project:** SENTINEL XDR / AI-IDS
**Team:**

| Name | Roll No. | Section |
|---|---|---|
| Adnan Faisal | F2023376084 | D1 |
| Muhammad Ahmad Raza | F2022266612 | D1 |
| Obaiz Mehmood | F2023376067 | A1 |
| Haider Ali | F2023376077 | A1 |

> Target similarity (Turnitin): **< 20%**. All passages below are paraphrased and must be checked before submission. Replace any access dates as needed.

---

## 1. Introduction to the Problem Domain

Intrusion Detection Systems (IDS) monitor network or host activity for malicious behaviour and policy violations. Classical IDS fall into two families: **signature-based** detection, which matches traffic against a database of known attack patterns, and **anomaly-based** detection, which models "normal" behaviour and flags deviations [1], [10]. Signature systems are precise for known threats but blind to novel attacks; anomaly systems generalise to new threats but suffer from high false-positive rates [4]. More recently, **machine-learning IDS (ML-IDS)** and, in the last two years, **Large-Language-Model (LLM) augmented** security tooling have emerged to bridge the gap between detection coverage and analyst interpretability [7], [8]. This review surveys eight representative works across these categories, identifies their limitations, and positions the SENTINEL XDR project against them.

---

## 2. Review of Related Work

### 2.1 Signature-Based IDS

**[1] Roesch (1999) — Snort.** Snort introduced a lightweight, rule-based network IDS that inspects packets against a community-maintained signature set. It remains the de-facto baseline for signature IDS. *Strength:* high precision and low false positives for known threats. *Limitation:* purely reactive — it cannot detect zero-day or obfuscated attacks, and rules require constant manual curation.

**[2] OISF (2010-) — Suricata.** Suricata extended the Snort model with multi-threading, protocol/flow awareness, and TLS metadata extraction, improving throughput on modern multi-core hardware. *Limitation:* it inherits the signature paradigm's inability to reason about *multi-stage* campaigns and still produces low-context alerts that human analysts must manually correlate.

### 2.2 Machine-Learning & Anomaly-Based IDS

**[3] Sharafaldin et al. (2018) — CICIDS2017.** This work produced a widely used labelled dataset and benchmarked classifiers (Random Forest, KNN, etc.) for flow-based intrusion detection. *Contribution:* a realistic, modern benchmark. *Limitation:* offline, flow-level classification; the models output a class label with no explanation, MITRE mapping, or remediation guidance.

**[4] Buczak & Guven (2016) — ML/Data-Mining for IDS (survey).** A comprehensive IEEE survey of ML methods (SVM, decision trees, clustering, neural nets) for cyber intrusion detection. *Key finding (and gap):* model accuracy is dataset-dependent and the *interpretability* of ML-IDS output is consistently cited as an unsolved operational problem.

**[10] Mirsky et al. (2018) — Kitsune.** An unsupervised, online anomaly IDS using an ensemble of autoencoders for plug-and-play deployment without labelled data. *Strength:* online, light-weight, no signatures. *Limitation:* anomaly scores are not human-readable and give no attack attribution or recommended response.

### 2.3 Knowledge Frameworks & Retrieval

**[5] Strom et al. (2018) — MITRE ATT&CK.** ATT&CK is a curated knowledge base of adversary tactics and techniques (TTPs). It is the lingua franca for describing attacker behaviour but is *not itself a detector* — it must be operationalised by a detection system.

**[6] Lewis et al. (2020) — Retrieval-Augmented Generation (RAG).** RAG couples a parametric LLM with a non-parametric retriever over an external corpus, improving factual grounding for knowledge-intensive tasks. *Relevance:* RAG is the mechanism by which an LLM can cite up-to-date ATT&CK knowledge rather than hallucinating it.

### 2.4 LLM-Augmented Security

**[7] Gupta et al. (2023) — "From ChatGPT to ThreatGPT" (IEEE Access).** Surveys both the offensive and defensive impact of generative AI in cybersecurity, arguing LLMs can accelerate triage, summarisation, and analyst assistance, while warning of prompt-injection and hallucination risks. *Gap:* it is a survey — it does not deliver an end-to-end LLM-driven detection pipeline.

**[8] Ferrag et al. (2024) — Generative AI / LLMs for cyber threat detection.** Recent work explores fine-tuned and prompted LLMs for malware and intrusion analysis, reporting promising classification and explanation quality. *Limitation:* most studies evaluate the LLM in isolation, decoupled from a live packet-capture and correlation pipeline, and rarely address multi-provider resilience or evasion of the LLM itself.

---

## 3. Comparative Analysis

| Work | Type | Detection | Explainable output | MITRE mapping | Multi-stage correlation | LLM/RAG | Live capture | Autonomous response |
|---|---|---|---|---|---|---|---|---|
| Snort [1] | Signature | Known only | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Suricata [2] | Signature+flow | Known only | ✗ | partial | ✗ | ✗ | ✓ | ✗ |
| CICIDS2017 ML [3] | ML (offline) | Known classes | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Kitsune [10] | Anomaly (online) | Novel | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| ML-IDS survey [4] | ML | Varies | ✗ (noted gap) | ✗ | ✗ | ✗ | varies | ✗ |
| ThreatGPT [7] | LLM survey | — | ✓ | ✓ | ✗ | partial | ✗ | ✗ |
| GenAI-IDS [8] | LLM | Known/novel | ✓ | partial | ✗ | partial | ✗ | ✗ |
| **SENTINEL XDR (ours)** | **Hybrid heuristic + LLM + RAG** | **Known + novel** | **✓ (NL + MITRE)** | **✓** | **✓ (MACE)** | **✓ (NVIDIA→Gemini→Groq + ChromaDB)** | **✓ (Scapy)** | **✓ (ADRS dry-run)** |

---

## 4. Identified Research Gaps & How SENTINEL Addresses Them

1. **Interpretability gap** [4], [10]: classical/ML IDS emit opaque scores or class labels. → SENTINEL pipes each flagged event through an LLM "SOC analyst" that returns a natural-language explanation, confidence, and a recommended action.
2. **Knowledge-grounding gap** [7]: standalone LLMs hallucinate. → SENTINEL uses **RAG over a 25-technique MITRE ATT&CK corpus (ChromaDB)** so explanations cite real TTP IDs.
3. **Multi-stage blindness** [1], [2], [3]: per-packet/per-flow detectors miss campaigns. → The **MACE** engine correlates atomic alerts into kill-chain attack chains.
4. **Resilience gap** [8]: single-provider LLM tools fail on rate-limits/outages. → A **three-tier provider fallback** (NVIDIA NIM → Gemini → Groq) with exponential back-off.
5. **Response gap**: most academic IDS stop at detection. → **ADRS** proposes (dry-run) containment policies, and **CHRONICLE** auto-generates executive incident narratives.
6. **LLM self-defence**: LLM tooling introduces a new attack surface (prompt injection). → The **AEGIS** engine scans for adversarial/prompt-injection patterns.

---

## 5. Conclusion of the Review

The literature shows a clear trajectory: signature IDS → ML/anomaly IDS → LLM-augmented security. Each step improved coverage but left **interpretability, grounding, multi-stage correlation, and response** only partially solved. SENTINEL XDR synthesises a **live heuristic detector**, a **RAG-grounded multi-provider LLM analyst**, **multi-stage correlation (MACE)**, and **autonomous (dry-run) response (ADRS/CHRONICLE)** into one pipeline — directly targeting the gaps catalogued above.

---

## References (IEEE format)

[1] M. Roesch, "Snort — Lightweight Intrusion Detection for Networks," in *Proc. 13th USENIX LISA Conf.*, 1999, pp. 229–238.

[2] Open Information Security Foundation, "Suricata IDS/IPS Engine," 2010–present. [Online]. Available: https://suricata.io

[3] I. Sharafaldin, A. H. Lashkari, and A. A. Ghorbani, "Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization," in *Proc. 4th Int. Conf. Inf. Syst. Secur. Privacy (ICISSP)*, 2018, pp. 108–116.

[4] A. L. Buczak and E. Guven, "A Survey of Data Mining and Machine Learning Methods for Cyber Security Intrusion Detection," *IEEE Commun. Surveys Tuts.*, vol. 18, no. 2, pp. 1153–1176, 2016.

[5] B. E. Strom et al., "MITRE ATT&CK: Design and Philosophy," The MITRE Corporation, Tech. Rep., 2018.

[6] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," in *Proc. NeurIPS*, 2020.

[7] M. Gupta, C. Akiri, K. Aryal, E. Parker, and L. Praharaj, "From ChatGPT to ThreatGPT: Impact of Generative AI in Cybersecurity and Privacy," *IEEE Access*, vol. 11, pp. 80218–80245, 2023.

[8] M. A. Ferrag et al., "Generative AI and Large Language Models for Cyber Security: A Review of Applications, Challenges and Future Directions," 2024. (Verify final venue/volume before submission.)

[9] A. Vaswani et al., "Attention Is All You Need," in *Proc. NeurIPS*, 2017.

[10] Y. Mirsky, T. Doitshman, Y. Elovici, and A. Shabtai, "Kitsune: An Ensemble of Autoencoders for Online Network Intrusion Detection," in *Proc. Netw. Distrib. Syst. Secur. Symp. (NDSS)*, 2018.
