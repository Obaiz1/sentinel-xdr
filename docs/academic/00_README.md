# Academic Deliverables — SENTINEL XDR (AI-IDS)

Written deliverables that were missing from the InfoSec project submission. The
implementation (Phases 4 & 5) is complete; these documents cover the missing
**written** marks. *(PPT slides intentionally excluded per request.)*

**Team:** Adnan Faisal (F2023376084, D1) · Muhammad Ahmad Raza (F2022266612, D1) · Obaiz Mehmood (F2023376067, A1) · Haider Ali (F2023376077, A1)

## Files & mark mapping

| File | Deliverable | Marks |
|---|---|---|
| `02_LITERATURE_REVIEW.md` | Phase 2 — Literature Review (8 works + comparison + gaps + IEEE refs) | 10 |
| `03_DESIGN_DOCUMENT.md` | Phase 3 — Design (architecture, level-0/1 DFD, STRIDE threat model, schema, API) | 10 |
| `06_FINAL_REPORT.md` | Phase 6 — Final Report (all 12 IEEE sections) | 20 |

## How to turn these into the required IEEE PDF

1. Open the `.md` in VS Code (with a Mermaid + Markdown-PDF extension) **or** paste into **Overleaf** using the official *IEEE conference* template, **or** paste into Word.
2. **Export the Mermaid diagrams to PNG** (mermaid.live → download) and insert them as numbered figures (the report references them).
3. Apply the required formatting: **Times New Roman 12 pt body, 14 pt bold headings, 1.5 line spacing, 1-inch margins, justified, page numbers, ≥ 15 pages.**
4. Auto-generate the Table of Contents and finalise References.

## ⚠️ What YOU must still do before submitting (do not skip)

1. **Run the controlled attack tests in §8.2 of the report** (`nmap -sS`, ping flood, port 4444, XMAS, DNS tunnel, benign control) on your own authorised host **with the local sniffer running**, and fill the *Measured* column + the false-positive count and TP/FPR numbers in §9.2. These must be **your real numbers**, not placeholders.
2. **Fill the cover-page** university name + submission date.
3. **Verify reference [8]** (Ferrag et al.) final venue/year on IEEE Xplore / Google Scholar before citing.
4. Run the report through **Turnitin (< 20%)** — everything here is paraphrased, but re-check after you add your own text.
5. (Viva) Build the slides yourself from the 34 Stitch screenshots; suggested talking points are in the report's Implementation + Results sections.

## Source of truth
All technical claims are derived from the actual implemented system in this repo
(`main.py`, `modules/`, `sentinel-ui/`) and the live deployment — not generic text.
