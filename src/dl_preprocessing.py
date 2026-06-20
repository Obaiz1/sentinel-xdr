"""
dl_preprocessing.py
-------------------
Preprocessing pipeline for the Sentinel XDR Deep Learning intrusion-detection
model. Loads the network-flow CSV, encodes categorical columns, scales numeric
columns, and produces train/test splits ready for a Keras ANN.

The fitted pipeline (ColumnTransformer) is persisted with joblib so the serving
API (deployment/dl_api.py) applies the *exact same* transformation at inference.

This module is import-safe: it has no side effects on import and is reused by
both training scripts and the API.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ---------------------------------------------------------------------------
# Schema — keep in one place so training and serving never drift apart.
# ---------------------------------------------------------------------------
NUMERIC_FEATURES = [
    "duration",
    "src_bytes",
    "dst_bytes",
    "count",
    "srv_count",
    "same_srv_rate",
]
CATEGORICAL_FEATURES = [
    "protocol_type",
    "service",
]
FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES
LABEL_COLUMN = "label"          # 0 = normal, 1 = attack
ATTACK_TYPE_COLUMN = "attack_type"

# Default on-disk locations (relative to repo root).
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DATA_PATH = os.path.join(REPO_ROOT, "data", "sample_network_flows.csv")
DEFAULT_PREPROCESSOR_PATH = os.path.join(REPO_ROOT, "artifacts", "dl_preprocessor.joblib")


@dataclass
class Dataset:
    """Container for a prepared train/test split."""
    X_train: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    preprocessor: ColumnTransformer
    feature_names: list[str]
    n_features: int


def load_raw(data_path: str = DEFAULT_DATA_PATH) -> pd.DataFrame:
    """Load the raw network-flow CSV and validate required columns."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(
            f"Dataset not found at {data_path}. Run data/_generate_sample.py first."
        )
    df = pd.read_csv(data_path)
    missing = set(FEATURE_COLUMNS + [LABEL_COLUMN]) - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {sorted(missing)}")
    return df


def build_preprocessor() -> ColumnTransformer:
    """Construct the (unfitted) feature pipeline: scale numeric + one-hot categorical."""
    numeric_pipeline = Pipeline(steps=[("scaler", StandardScaler())])
    categorical_pipeline = Pipeline(
        steps=[("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, NUMERIC_FEATURES),
            ("cat", categorical_pipeline, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )


def _feature_names(preprocessor: ColumnTransformer) -> list[str]:
    try:
        return list(preprocessor.get_feature_names_out())
    except Exception:  # pragma: no cover - older sklearn fallback
        return [f"f{i}" for i in range(preprocessor.transform_output_shape_[1])]


def prepare(
    data_path: str = DEFAULT_DATA_PATH,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Dataset:
    """Load, fit the preprocessor on the training split, and return arrays."""
    df = load_raw(data_path)
    X = df[FEATURE_COLUMNS].copy()
    y = df[LABEL_COLUMN].astype(int).to_numpy()

    X_train_df, X_test_df, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    preprocessor = build_preprocessor()
    X_train = preprocessor.fit_transform(X_train_df)
    X_test = preprocessor.transform(X_test_df)

    feature_names = _feature_names(preprocessor)
    return Dataset(
        X_train=np.asarray(X_train, dtype="float32"),
        X_test=np.asarray(X_test, dtype="float32"),
        y_train=y_train.astype("float32"),
        y_test=y_test.astype("float32"),
        preprocessor=preprocessor,
        feature_names=feature_names,
        n_features=X_train.shape[1],
    )


def save_preprocessor(
    preprocessor: ColumnTransformer, path: str = DEFAULT_PREPROCESSOR_PATH
) -> str:
    """Persist the fitted preprocessor for use by the serving API."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(preprocessor, path)
    return path


def load_preprocessor(path: str = DEFAULT_PREPROCESSOR_PATH) -> ColumnTransformer:
    """Load a previously fitted preprocessor."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Preprocessor not found at {path}. Train a model first (training/train_v1.py)."
        )
    return joblib.load(path)


def transform_records(records, preprocessor: ColumnTransformer) -> np.ndarray:
    """Transform a list of feature dicts (API payloads) into a model-ready array."""
    df = pd.DataFrame(records)
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            raise ValueError(f"Missing required feature: {col}")
    df = df[FEATURE_COLUMNS]
    return np.asarray(preprocessor.transform(df), dtype="float32")


if __name__ == "__main__":  # quick smoke test
    ds = prepare()
    print(f"Train: {ds.X_train.shape}  Test: {ds.X_test.shape}  Features: {ds.n_features}")
    print(f"Feature names ({len(ds.feature_names)}): {ds.feature_names}")
    print(f"Train attack ratio: {ds.y_train.mean():.2f}  Test attack ratio: {ds.y_test.mean():.2f}")
