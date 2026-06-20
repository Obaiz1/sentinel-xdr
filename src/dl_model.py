"""
dl_model.py
-----------
Keras model architectures for the Sentinel XDR intrusion-detection classifier.

Two versions, as required by the assignment:

  * Model V1 (baseline) — a compact 2-layer ANN. Establishes a reference point.
  * Model V2 (improved) — a deeper, regularised ANN: more capacity, BatchNorm,
    Dropout, and an Adam optimiser with a tuned learning rate. Demonstrates the
    effect of architecture improvements + regularisation over the baseline.

Both are binary classifiers (sigmoid output): normal=0 vs attack=1.
"""
from __future__ import annotations

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def build_model_v1(input_dim: int, learning_rate: float = 1e-3) -> keras.Model:
    """Baseline ANN: two small dense layers, ReLU, sigmoid head."""
    model = keras.Sequential(
        [
            keras.Input(shape=(input_dim,), name="features"),
            layers.Dense(32, activation="relu", name="dense_1"),
            layers.Dense(16, activation="relu", name="dense_2"),
            layers.Dense(1, activation="sigmoid", name="output"),
        ],
        name="sentinel_dl_v1",
    )
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="binary_crossentropy",
        metrics=[
            keras.metrics.BinaryAccuracy(name="accuracy"),
            keras.metrics.Precision(name="precision"),
            keras.metrics.Recall(name="recall"),
            keras.metrics.AUC(name="auc"),
        ],
    )
    return model


def build_model_v2(
    input_dim: int,
    learning_rate: float = 5e-4,
    dropout: float = 0.3,
) -> keras.Model:
    """Improved ANN: deeper, BatchNorm + Dropout regularisation, lower LR."""
    model = keras.Sequential(
        [
            keras.Input(shape=(input_dim,), name="features"),
            layers.Dense(128, activation="relu", name="dense_1"),
            layers.BatchNormalization(name="bn_1"),
            layers.Dropout(dropout, name="dropout_1"),
            layers.Dense(64, activation="relu", name="dense_2"),
            layers.BatchNormalization(name="bn_2"),
            layers.Dropout(dropout, name="dropout_2"),
            layers.Dense(32, activation="relu", name="dense_3"),
            layers.Dropout(dropout / 2, name="dropout_3"),
            layers.Dense(1, activation="sigmoid", name="output"),
        ],
        name="sentinel_dl_v2",
    )
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="binary_crossentropy",
        metrics=[
            keras.metrics.BinaryAccuracy(name="accuracy"),
            keras.metrics.Precision(name="precision"),
            keras.metrics.Recall(name="recall"),
            keras.metrics.AUC(name="auc"),
        ],
    )
    return model


def model_summary_text(model: keras.Model) -> str:
    """Return the model.summary() as a string (handy for logging to MLflow)."""
    lines: list[str] = []
    model.summary(print_fn=lines.append)
    return "\n".join(lines)


if __name__ == "__main__":
    print("TensorFlow:", tf.__version__)
    v1 = build_model_v1(15)
    v2 = build_model_v2(15)
    print(model_summary_text(v1))
    print(model_summary_text(v2))
