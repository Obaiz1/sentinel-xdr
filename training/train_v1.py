"""
train_v1.py — Train the BASELINE Sentinel XDR IDS model (Model V1).

Usage:
    python training/train_v1.py
    python training/train_v1.py --epochs 60 --batch-size 16

Logs parameters, metrics, and artifacts to MLflow (local ./mlruns store),
saves the model to models/sentinel_dl_v1.keras, and saves the fitted
preprocessor to artifacts/dl_preprocessor.joblib (shared with the API).
"""
from __future__ import annotations

import argparse
import os
import sys

# Allow `import src...` when run as `python training/train_v1.py`.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from src import dl_preprocessing as prep  # noqa: E402
from src.dl_model import build_model_v1, model_summary_text  # noqa: E402
from training import _common as common  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Train Sentinel XDR IDS Model V1 (baseline)")
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--learning-rate", type=float, default=1e-3)
    ap.add_argument("--data", type=str, default=prep.DEFAULT_DATA_PATH)
    ap.add_argument("--no-register", action="store_true", help="skip MLflow model registry")
    args = ap.parse_args()

    print("Loading + preprocessing data ...")
    ds = prep.prepare(data_path=args.data)
    print(f"  train={ds.X_train.shape}  test={ds.X_test.shape}  n_features={ds.n_features}")

    # Persist the preprocessor so the serving API transforms inputs identically.
    pre_path = prep.save_preprocessor(ds.preprocessor)
    print(f"  preprocessor -> {pre_path}")

    model = build_model_v1(ds.n_features, learning_rate=args.learning_rate)
    print(model_summary_text(model))

    history = model.fit(
        ds.X_train, ds.y_train,
        validation_split=0.2,
        epochs=args.epochs,
        batch_size=args.batch_size,
        verbose=2,
    )

    metrics, cm, report = common.evaluate(model, ds.X_test, ds.y_test)
    common.print_metrics("sentinel_dl_v1", metrics, report)

    params = {
        "model_version": "v1_baseline",
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "optimizer": "adam",
        "hidden_layers": "32-16",
        "regularization": "none",
        "n_features": ds.n_features,
        "train_samples": int(ds.X_train.shape[0]),
        "test_samples": int(ds.X_test.shape[0]),
    }
    common.log_run(
        model=model,
        model_name="sentinel_dl_v1",
        params=params,
        metrics=metrics,
        cm=cm,
        report=report,
        history=history,
        preprocessor_path=pre_path,
        feature_names=ds.feature_names,
        register=not args.no_register,
    )
    print("\nModel V1 training complete.")


if __name__ == "__main__":
    main()
