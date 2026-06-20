"""
dl_api.py — FastAPI service that serves the Sentinel XDR Deep Learning IDS model.

Endpoints (as required by the assignment):
    GET  /          -> service metadata + links
    GET  /health    -> liveness/readiness probe (model + preprocessor loaded?)
    POST /predict   -> classify one or more network flows (normal vs attack)

Run locally:
    uvicorn deployment.dl_api:app --host 0.0.0.0 --port 8000

The model + preprocessor are loaded lazily on first use (and at startup) from
the paths written by the training scripts. Override with env vars:
    SENTINEL_DL_MODEL_PATH, SENTINEL_DL_PREPROCESSOR_PATH
"""
from __future__ import annotations

import os
import sys
import time
from typing import List, Optional

# Make `import src...` work regardless of launch directory.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import numpy as np  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from src import dl_preprocessing as prep  # noqa: E402

MODEL_PATH = os.environ.get(
    "SENTINEL_DL_MODEL_PATH", os.path.join(REPO_ROOT, "models", "sentinel_dl_v2.keras")
)
FALLBACK_MODEL_PATH = os.path.join(REPO_ROOT, "models", "sentinel_dl_v1.keras")
PREPROCESSOR_PATH = os.environ.get(
    "SENTINEL_DL_PREPROCESSOR_PATH", prep.DEFAULT_PREPROCESSOR_PATH
)

ATTACK_THRESHOLD = float(os.environ.get("SENTINEL_DL_THRESHOLD", "0.5"))

app = FastAPI(
    title="Sentinel XDR — Deep Learning IDS API",
    description="Binary intrusion detection (normal vs attack) over network-flow features.",
    version="1.0.0",
)

# Allow the dashboard (Vercel) and local dev to call this API from the browser.
# Override with SENTINEL_DL_CORS_ORIGINS (comma-separated) to restrict origins.
_cors = os.environ.get("SENTINEL_DL_CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _cors.strip() == "*" else [o.strip() for o in _cors.split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazily-populated globals.
_model = None
_preprocessor = None
_model_path_used: Optional[str] = None


# --------------------------- request/response schema ---------------------------
class NetworkFlow(BaseModel):
    """One network-flow record. Field names match the training schema."""
    duration: float = Field(..., examples=[5])
    protocol_type: str = Field(..., examples=["tcp"])
    service: str = Field(..., examples=["private"])
    src_bytes: float = Field(..., examples=[100])
    dst_bytes: float = Field(..., examples=[8])
    count: float = Field(..., examples=[168])
    srv_count: float = Field(..., examples=[53])
    same_srv_rate: float = Field(..., examples=[0.32])


class PredictRequest(BaseModel):
    flows: List[NetworkFlow] = Field(..., min_length=1)


class Prediction(BaseModel):
    label: int            # 0 = normal, 1 = attack
    label_name: str
    attack_probability: float
    confidence: float


class PredictResponse(BaseModel):
    model_config = {"protected_namespaces": ()}  # allow the "model_path" field name
    model_path: str
    threshold: float
    count: int
    predictions: List[Prediction]


# --------------------------------- loading -----------------------------------
def _load_artifacts() -> None:
    """Load the Keras model + preprocessor into module globals (idempotent)."""
    global _model, _preprocessor, _model_path_used
    if _model is not None and _preprocessor is not None:
        return

    # Import tensorflow lazily so the module imports fast (and CI can lint it).
    from tensorflow import keras  # noqa: WPS433

    model_path = MODEL_PATH if os.path.exists(MODEL_PATH) else FALLBACK_MODEL_PATH
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            "No trained model found. Run training/train_v1.py (and train_v2.py) first."
        )
    _model = keras.models.load_model(model_path)
    _model_path_used = model_path
    _preprocessor = prep.load_preprocessor(PREPROCESSOR_PATH)


@app.on_event("startup")
def _startup() -> None:
    # Best-effort warm load; /health still reports status if this fails.
    try:
        _load_artifacts()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] model not loaded yet: {exc}")


# --------------------------------- endpoints ---------------------------------
@app.get("/")
def root() -> dict:
    return {
        "service": "Sentinel XDR — Deep Learning IDS API",
        "version": app.version,
        "model_loaded": _model is not None,
        "endpoints": {
            "health": "GET /health",
            "predict": "POST /predict",
            "docs": "GET /docs",
        },
        "schema": {
            "features": prep.FEATURE_COLUMNS,
            "labels": {"0": "normal", "1": "attack"},
        },
    }


@app.get("/health")
def health() -> dict:
    ready = _model is not None and _preprocessor is not None
    if not ready:
        # Try once more so the first probe after startup can succeed.
        try:
            _load_artifacts()
            ready = True
        except Exception as exc:  # noqa: BLE001
            return {"status": "degraded", "model_loaded": False, "reason": str(exc)}
    return {
        "status": "ok",
        "model_loaded": True,
        "model_path": os.path.basename(_model_path_used or ""),
        "threshold": ATTACK_THRESHOLD,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    try:
        _load_artifacts()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Model unavailable: {exc}")

    records = [flow.model_dump() for flow in request.flows]
    try:
        X = prep.transform_records(records, _preprocessor)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    probs = _model.predict(X, verbose=0).ravel()
    predictions: list[Prediction] = []
    for p in probs:
        p = float(p)
        label = int(p >= ATTACK_THRESHOLD)
        predictions.append(
            Prediction(
                label=label,
                label_name="attack" if label else "normal",
                attack_probability=round(p, 4),
                confidence=round(p if label else 1.0 - p, 4),
            )
        )

    return PredictResponse(
        model_path=os.path.basename(_model_path_used or ""),
        threshold=ATTACK_THRESHOLD,
        count=len(predictions),
        predictions=predictions,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("deployment.dl_api:app", host="0.0.0.0", port=8000, reload=False)
