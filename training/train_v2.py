"""
train_v2.py — Train the IMPROVED Sentinel XDR IDS model (Model V2).

Improvements over V1:
  * Deeper architecture (128-64-32 vs 32-16)
  * BatchNormalization + Dropout regularisation
  * Lower learning rate (5e-4) + EarlyStopping on val_loss
  * More epochs budget (early-stopped)

Usage:
    python training/train_v2.py
    python training/train_v2.py --epochs 120 --dropout 0.35

Logs to the SAME MLflow experiment as V1 so the two runs can be compared
side by side in the MLflow UI.
"""
from __future__ import annotations

import argparse
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from tensorflow import keras  # noqa: E402

from src import dl_preprocessing as prep  # noqa: E402
from src.dl_model import build_model_v2, model_summary_text  # noqa: E402
from training import _common as common  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Train Sentinel XDR IDS Model V2 (improved)")
    ap.add_argument("--epochs", type=int, default=120)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--learning-rate", type=float, default=5e-4)
    ap.add_argument("--dropout", type=float, default=0.3)
    ap.add_argument("--patience", type=int, default=15)
    ap.add_argument("--data", type=str, default=prep.DEFAULT_DATA_PATH)
    ap.add_argument("--no-register", action="store_true", help="skip MLflow model registry")
    args = ap.parse_args()

    print("Loading + preprocessing data ...")
    ds = prep.prepare(data_path=args.data)
    print(f"  train={ds.X_train.shape}  test={ds.X_test.shape}  n_features={ds.n_features}")

    pre_path = prep.save_preprocessor(ds.preprocessor)
    print(f"  preprocessor -> {pre_path}")

    model = build_model_v2(
        ds.n_features, learning_rate=args.learning_rate, dropout=args.dropout
    )
    print(model_summary_text(model))

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=args.patience,
            restore_best_weights=True, verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=max(3, args.patience // 3),
            min_lr=1e-5, verbose=1,
        ),
    ]

    history = model.fit(
        ds.X_train, ds.y_train,
        validation_split=0.2,
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        verbose=2,
    )

    metrics, cm, report = common.evaluate(model, ds.X_test, ds.y_test)
    common.print_metrics("sentinel_dl_v2", metrics, report)

    params = {
        "model_version": "v2_improved",
        "epochs_max": args.epochs,
        "epochs_ran": len(history.history["loss"]),
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "optimizer": "adam",
        "hidden_layers": "128-64-32",
        "regularization": f"batchnorm+dropout({args.dropout})",
        "early_stopping_patience": args.patience,
        "n_features": ds.n_features,
        "train_samples": int(ds.X_train.shape[0]),
        "test_samples": int(ds.X_test.shape[0]),
    }
    common.log_run(
        model=model,
        model_name="sentinel_dl_v2",
        params=params,
        metrics=metrics,
        cm=cm,
        report=report,
        history=history,
        preprocessor_path=pre_path,
        feature_names=ds.feature_names,
        register=not args.no_register,
    )
    print("\nModel V2 training complete.")


if __name__ == "__main__":
    main()
