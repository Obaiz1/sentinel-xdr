"""
compare_models.py — Build the V1 vs V2 comparison report.

Reads the per-model metrics JSON written by the training scripts
(artifacts/metrics_sentinel_dl_v1.json, ..._v2.json) and prints + writes a
side-by-side comparison table to artifacts/model_comparison.md.

Run AFTER train_v1.py and train_v2.py.
"""
from __future__ import annotations

import json
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(REPO_ROOT, "artifacts")

MODELS = [("Model V1 (baseline)", "sentinel_dl_v1"), ("Model V2 (improved)", "sentinel_dl_v2")]
METRIC_KEYS = ["accuracy", "precision", "recall", "f1", "roc_auc"]


def _load(name: str) -> dict | None:
    path = os.path.join(ARTIFACTS_DIR, f"metrics_{name}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def main() -> None:
    rows = {label: _load(key) for label, key in MODELS}
    missing = [label for label, m in rows.items() if m is None]
    if missing:
        print(f"Missing metrics for: {missing}. Train both models first.")
        return

    header = "| Metric | " + " | ".join(rows.keys()) + " | Delta (V2-V1) |"
    sep = "|" + "---|" * (len(rows) + 2)
    lines = ["# Sentinel XDR - Model Comparison (V1 vs V2)", "", header, sep]
    for k in METRIC_KEYS:
        v1 = rows["Model V1 (baseline)"][k]
        v2 = rows["Model V2 (improved)"][k]
        delta = v2 - v1
        lines.append(
            f"| {k} | {v1:.4f} | {v2:.4f} | {delta:+.4f} |"
        )

    report = "\n".join(lines) + "\n"
    out = os.path.join(ARTIFACTS_DIR, "model_comparison.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write(report)
    print(report)
    print(f"[saved] -> {out}")


if __name__ == "__main__":
    main()
