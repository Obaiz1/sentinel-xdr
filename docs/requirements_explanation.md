# Requirements — what each file is for

The Deep Learning final project uses **split requirement files** so each role
installs only what it needs. The original project's `requirements.txt` (the
Sentinel XDR security backend) is **untouched**.

| File | Used by | Why it exists |
|---|---|---|
| `requirements-final.txt` | A single local virtualenv that does *everything* (train + serve + MLflow). | Convenience superset for development. |
| `requirements-training.txt` | Training Models V1/V2 and logging to MLflow. | Heavy ML stack (TensorFlow, scikit-learn, matplotlib, mlflow). |
| `requirements-api.txt` | The Docker serving image (`Dockerfile.final-project`). | Minimal inference deps → smaller, faster container. No MLflow/matplotlib. |
| `requirements-ci.txt` | GitHub Actions CI. | Ultra-light (flake8 + pyyaml + pandas). **No TensorFlow** → CI runs in seconds, not minutes. |

## Key packages

- **tensorflow-cpu==2.16.1** — the deep-learning framework (Keras API) used to
  build and train the ANN classifiers. CPU build (no GPU needed for this dataset).
- **scikit-learn==1.5.0** — preprocessing (`StandardScaler`, `OneHotEncoder`,
  `ColumnTransformer`), the train/test split, and evaluation metrics.
- **pandas / numpy** — data loading and array handling.
- **joblib** — persists the fitted preprocessor so training and serving apply the
  exact same transformation.
- **mlflow==2.14.1** — experiment tracking: parameters, metrics, artifacts, and
  the model registry.
- **fastapi + uvicorn + pydantic** — the model-serving REST API (`/`, `/health`,
  `/predict`) with request validation and auto-generated `/docs`.
- **matplotlib** — renders confusion-matrix and training-history PNGs (logged to
  MLflow and saved in `artifacts/`).
- **flake8 / pyyaml** — CI lint + YAML validation only.

## ⚠️ Python version

`tensorflow-cpu==2.16.1` ships wheels for **Python 3.9–3.11**. Use **Python
3.11** for the DL virtualenv:

```bash
python3.11 -m venv .venv-dl
source .venv-dl/bin/activate          # Windows: .venv-dl\Scripts\activate
pip install -r requirements-final.txt
```

The existing Sentinel XDR backend uses a separate environment — the two never mix.
