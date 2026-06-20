# Sentinel XDR — Deep Learning Based Intrusion Detection & Cyber Threat Classification

> **Deep Learning Final Project** — a clean add-on module built on top of the
> existing Sentinel XDR security platform. It trains, tracks, serves,
> containerises, and deploys a neural-network intrusion-detection classifier
> end-to-end (MLflow → FastAPI → Docker → GitHub Actions → Kubernetes/Minikube).

This module is **self-contained**: it lives entirely in new folders (`src/`,
`training/`, `deployment/`, `data/`, `models/`, `artifacts/`, `kubernetes/`) and
**does not modify** the existing XDR backend (`main.py`, `modules/`) or the
dashboard (`sentinel-ui/`).

---

## 1. Problem statement & significance

Network intrusion detection systems must separate malicious traffic from benign
traffic in real time. Rule-based detection misses novel/obfuscated attacks. We
frame intrusion detection as a **supervised binary classification** problem over
network-flow features and train a deep neural network to label each flow as
**normal (0)** or **attack (1)**.

- **Real-world significance:** automated, learning-based triage of network flows
  reduces analyst load and catches statistically anomalous behaviour that static
  signatures miss. This DL classifier complements Sentinel XDR's existing
  heuristic + LLM triage with a trained, measurable model.
- **Dataset source:** the committed `data/sample_network_flows.csv` is an
  NSL-KDD-style flow dataset (the schema mirrors the canonical
  **NSL-KDD / CICIDS2017 / UNSW-NB15** intrusion-detection feature sets:
  `duration, protocol_type, service, src_bytes, dst_bytes, count, srv_count,
  same_srv_rate`). It is bundled so the whole pipeline runs offline; swap in the
  full NSL-KDD CSV with the same columns to scale up.
- **Expected outcomes:** a trained classifier with high accuracy/recall on the
  held-out test set, two compared model versions, a served prediction API, and a
  reproducible MLOps pipeline.

## 2. Project structure

```
src/
  dl_preprocessing.py     # load CSV, scale numeric + one-hot categorical, split
  dl_model.py             # build_model_v1 (baseline), build_model_v2 (improved)
training/
  train_v1.py             # train baseline  -> MLflow + models/sentinel_dl_v1.keras
  train_v2.py             # train improved  -> MLflow + models/sentinel_dl_v2.keras
  compare_models.py       # V1 vs V2 comparison report
  _common.py              # shared eval + plots + MLflow logging
deployment/
  dl_api.py               # FastAPI service: GET / , GET /health , POST /predict
data/
  sample_network_flows.csv  # bundled NSL-KDD-style dataset (220 rows)
  _generate_sample.py       # deterministic dataset generator (stdlib only)
models/                   # trained .keras models (written by training)
artifacts/                # preprocessor, confusion matrices, metrics, comparison
kubernetes/
  deployment.yaml         # Deployment (2 replicas, health probes)
  service.yaml            # NodePort service (30080)
.github/workflows/
  final-project-ci.yml    # lint + validate CI (no heavy training)
requirements-final.txt    # full local env (train + serve + mlflow)
requirements-training.txt # training only
requirements-api.txt      # serving only (used by Docker)
requirements-ci.txt       # CI only (flake8 + yaml)
Dockerfile.final-project  # serving container (python:3.11-slim)
docker-compose.final.yml  # local one-command serving
docs/requirements_explanation.md
docs/commands_for_screenshots.md
```

## 3. Quickstart

```bash
# Python 3.11 is required (TensorFlow 2.16 has no 3.12+ wheels).
python3.11 -m venv .venv-dl
source .venv-dl/bin/activate              # Windows: .venv-dl\Scripts\activate
pip install -r requirements-final.txt

# 1) Train both models (logs to ./mlruns, saves to models/ + artifacts/)
python training/train_v1.py
python training/train_v2.py
python training/compare_models.py

# 2) Track experiments
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000   # http://localhost:5000

# 3) Serve predictions
uvicorn deployment.dl_api:app --host 0.0.0.0 --port 8000   # http://localhost:8000/docs
```

## 4. Model V1 vs V2

| | Model V1 (baseline) | Model V2 (improved) |
|---|---|---|
| Architecture | Dense 32 → 16 → 1 | Dense 128 → 64 → 32 → 1 |
| Regularisation | none | BatchNorm + Dropout(0.3) |
| Optimiser / LR | Adam, 1e-3 | Adam, 5e-4 |
| Callbacks | — | EarlyStopping + ReduceLROnPlateau |
| Purpose | reference baseline | architecture + regularisation improvement |

Both are evaluated on the identical held-out split with accuracy, precision,
recall, F1, and ROC-AUC. `compare_models.py` writes the side-by-side table to
`artifacts/model_comparison.md`.

## 5. API

| Method | Path | Description |
|---|---|---|
| GET | `/` | Service metadata + feature schema |
| GET | `/health` | Liveness/readiness (model + preprocessor loaded) |
| POST | `/predict` | Classify one or more network flows |

`POST /predict` body:

```json
{ "flows": [
  {"duration":2,"protocol_type":"tcp","service":"private","src_bytes":60,
   "dst_bytes":40,"count":200,"srv_count":20,"same_srv_rate":0.1}
]}
```

Response: per-flow `label` (0/1), `label_name`, `attack_probability`, `confidence`.

## 6. Docker, CI/CD, Kubernetes

```bash
# Docker
docker build -f Dockerfile.final-project -t sentinel-xdr-final:v1 .
docker run -p 8000:8000 sentinel-xdr-final:v1

# Kubernetes (Minikube)
minikube start
eval $(minikube docker-env)
docker build -f Dockerfile.final-project -t sentinel-xdr-final:v1 .
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
kubectl get pods && kubectl get services
```

**CI/CD:** `.github/workflows/final-project-ci.yml` runs on every push touching
the DL files — it lints, byte-compiles, validates the dataset schema, and checks
the Kubernetes/Docker manifests. It intentionally does **not** train (too heavy
for CI runners).

See **`docs/commands_for_screenshots.md`** for the full command list mapped to
every required screenshot and demo-video section, and
**`docs/requirements_explanation.md`** for what each dependency does.

## 7. Rubric coverage

| Rubric item | Where |
|---|---|
| §1 Problem / dataset / outcomes | this README §1 |
| §4 Model V1 + V2 + comparison | `src/dl_model.py`, `training/`, `compare_models.py` |
| §5 MLflow tracking | `training/_common.py` (params, metrics, artifacts, registry) |
| §6 FastAPI `/ /predict /health` | `deployment/dl_api.py` |
| §7 Docker | `Dockerfile.final-project`, `docker-compose.final.yml` |
| §8 Git/GitHub structure | repo layout above |
| §9 CI/CD (GitHub Actions) | `.github/workflows/final-project-ci.yml` |
| §10 Kubernetes (Minikube) | `kubernetes/deployment.yaml`, `service.yaml` |
