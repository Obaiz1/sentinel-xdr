"""
_common.py
----------
Shared training utilities for both model versions: evaluation metrics, confusion
-matrix plotting, and a single MLflow logging routine. Keeping this in one place
guarantees V1 and V2 are compared on identical metrics and the same data split.
"""
from __future__ import annotations

import json
import os
import sys

import matplotlib

matplotlib.use("Agg")  # headless / server-safe
import matplotlib.pyplot as plt
import mlflow
import mlflow.tensorflow
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

# Make `import src...` work no matter where the script is launched from.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

ARTIFACTS_DIR = os.path.join(REPO_ROOT, "artifacts")
MODELS_DIR = os.path.join(REPO_ROOT, "models")
# SQLite backend so the MLflow Model Registry works (file:// stores cannot
# register models). Artifacts land under ./mlruns by default.
MLFLOW_DB = os.path.join(REPO_ROOT, "mlflow.db")
EXPERIMENT_NAME = "sentinel-xdr-ids"


def configure_mlflow() -> None:
    """Point MLflow at a local SQLite-backed tracking store inside the repo."""
    tracking_uri = os.environ.get(
        "MLFLOW_TRACKING_URI", f"sqlite:///{MLFLOW_DB.replace(os.sep, '/')}"
    )
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(EXPERIMENT_NAME)


def evaluate(model, X_test, y_test) -> tuple[dict, np.ndarray, str]:
    """Compute the full metric suite + confusion matrix + text report."""
    probs = model.predict(X_test, verbose=0).ravel()
    preds = (probs >= 0.5).astype(int)
    y_true = y_test.astype(int)

    metrics = {
        "accuracy": float(accuracy_score(y_true, preds)),
        "precision": float(precision_score(y_true, preds, zero_division=0)),
        "recall": float(recall_score(y_true, preds, zero_division=0)),
        "f1": float(f1_score(y_true, preds, zero_division=0)),
    }
    # AUC needs both classes present in y_true.
    try:
        metrics["roc_auc"] = float(roc_auc_score(y_true, probs))
    except ValueError:
        metrics["roc_auc"] = float("nan")

    cm = confusion_matrix(y_true, preds)
    report = classification_report(
        y_true, preds, target_names=["normal", "attack"], zero_division=0
    )
    return metrics, cm, report


def save_confusion_matrix(cm: np.ndarray, model_name: str) -> str:
    """Render the confusion matrix to a PNG in artifacts/ and return its path."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    fig, ax = plt.subplots(figsize=(4.5, 4))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_title(f"Confusion Matrix — {model_name}")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_xticks([0, 1], labels=["normal", "attack"])
    ax.set_yticks([0, 1], labels=["normal", "attack"])
    thresh = cm.max() / 2.0 if cm.max() else 0.5
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j, i, str(cm[i, j]), ha="center", va="center",
                color="white" if cm[i, j] > thresh else "black",
            )
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    out = os.path.join(ARTIFACTS_DIR, f"confusion_matrix_{model_name}.png")
    fig.savefig(out, dpi=120)
    plt.close(fig)
    return out


def save_history_plot(history, model_name: str) -> str:
    """Plot training/validation accuracy + loss curves to a PNG."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    h = history.history
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3.5))
    ax1.plot(h.get("accuracy", []), label="train")
    ax1.plot(h.get("val_accuracy", []), label="val")
    ax1.set_title(f"{model_name} — accuracy")
    ax1.set_xlabel("epoch")
    ax1.legend()
    ax2.plot(h.get("loss", []), label="train")
    ax2.plot(h.get("val_loss", []), label="val")
    ax2.set_title(f"{model_name} — loss")
    ax2.set_xlabel("epoch")
    ax2.legend()
    fig.tight_layout()
    out = os.path.join(ARTIFACTS_DIR, f"history_{model_name}.png")
    fig.savefig(out, dpi=120)
    plt.close(fig)
    return out


def log_run(
    *,
    model,
    model_name: str,
    params: dict,
    metrics: dict,
    cm: np.ndarray,
    report: str,
    history,
    preprocessor_path: str,
    feature_names: list[str],
    register: bool = True,
) -> str:
    """Persist the model + log everything to MLflow under one run. Returns model path."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, f"{model_name}.keras")
    model.save(model_path)

    cm_png = save_confusion_matrix(cm, model_name)
    hist_png = save_history_plot(history, model_name)
    report_txt = os.path.join(ARTIFACTS_DIR, f"classification_report_{model_name}.txt")
    with open(report_txt, "w") as f:
        f.write(report)
    metrics_json = os.path.join(ARTIFACTS_DIR, f"metrics_{model_name}.json")
    with open(metrics_json, "w") as f:
        json.dump(metrics, f, indent=2)
    features_json = os.path.join(ARTIFACTS_DIR, f"feature_names_{model_name}.json")
    with open(features_json, "w") as f:
        json.dump(feature_names, f, indent=2)

    configure_mlflow()
    with mlflow.start_run(run_name=model_name) as run:
        mlflow.set_tag("project", "sentinel-xdr")
        mlflow.set_tag("model_version", model_name)
        mlflow.log_params(params)
        mlflow.log_metrics(metrics)
        for artifact in (cm_png, hist_png, report_txt, metrics_json, features_json):
            mlflow.log_artifact(artifact, artifact_path="evaluation")
        if os.path.exists(preprocessor_path):
            mlflow.log_artifact(preprocessor_path, artifact_path="preprocessor")
        # Log the Keras model itself; optionally register it in the Model Registry.
        try:
            kwargs = {"registered_model_name": "sentinel-xdr-ids"} if register else {}
            mlflow.tensorflow.log_model(model, artifact_path="model", **kwargs)
        except Exception as exc:  # registry needs a DB-backed store; don't fail the run
            print(f"[mlflow] registry log failed, retrying unregistered ({exc})")
            try:
                mlflow.tensorflow.log_model(model, artifact_path="model")
            except Exception as exc2:  # last resort: log the saved file as an artifact
                print(f"[mlflow] flavor log failed, logging .keras file instead ({exc2})")
                mlflow.log_artifact(model_path, artifact_path="model")
        run_id = run.info.run_id

    print(f"\n[mlflow] run_id={run_id}  experiment={EXPERIMENT_NAME}")
    print(f"[saved ] model      -> {model_path}")
    print(f"[saved ] confusion  -> {cm_png}")
    return model_path


def print_metrics(model_name: str, metrics: dict, report: str) -> None:
    print(f"\n===== {model_name} — evaluation =====")
    for k, v in metrics.items():
        print(f"  {k:10s}: {v:.4f}")
    print(report)
