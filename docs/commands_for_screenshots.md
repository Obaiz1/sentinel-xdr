# Commands for screenshots / demo video

Run these in order on **Linux (Ubuntu 22.04/24.04)** as required by the rubric.
Each block maps to a required screenshot / a section of the 5–10 min demo video.

> Assumes you are at the repo root with the DL virtualenv active:
> ```bash
> python3.11 -m venv .venv-dl && source .venv-dl/bin/activate
> pip install -r requirements-final.txt
> ```

---

## 0. Linux environment (rubric §2)

```bash
lsb_release -a                       # show Ubuntu version
python3 --version                    # 3.11.x
source .venv-dl/bin/activate         # virtual environment
pip list | head                      # package management
ls -l src training deployment        # file structure / permissions
ps aux | grep uvicorn                # process management (after API starts)
```

## 1. Train both models + MLflow tracking (rubric §4, §5)

```bash
python data/_generate_sample.py      # (re)generate dataset if needed
python training/train_v1.py          # baseline -> models/sentinel_dl_v1.keras
python training/train_v2.py          # improved -> models/sentinel_dl_v2.keras
python training/compare_models.py    # writes artifacts/model_comparison.md
```

### MLflow dashboard (screenshot: experiment runs, run comparison, registered model)

```bash
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
# open http://localhost:5000  -> experiment "sentinel-xdr-ids"
#   * screenshot the run list (V1 + V2)
#   * select both runs -> "Compare" -> screenshot
#   * Models tab -> "sentinel-xdr-ids" registered model -> screenshot
```

## 2. Serve the model with FastAPI (rubric §6)

```bash
uvicorn deployment.dl_api:app --host 0.0.0.0 --port 8000
# open http://localhost:8000/docs   (Swagger UI — screenshot)
```

### Test the endpoints (screenshot: API running + prediction result)

```bash
curl -s http://localhost:8000/health | python3 -m json.tool

# Predict an ATTACK-looking flow (port scan / probe):
curl -s -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"flows":[{"duration":2,"protocol_type":"tcp","service":"private","src_bytes":60,"dst_bytes":40,"count":200,"srv_count":20,"same_srv_rate":0.1}]}' \
  | python3 -m json.tool

# Predict a NORMAL-looking flow:
curl -s -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"flows":[{"duration":30,"protocol_type":"tcp","service":"http","src_bytes":2500,"dst_bytes":8000,"count":8,"srv_count":7,"same_srv_rate":0.9}]}' \
  | python3 -m json.tool
```

## 3. Docker (rubric §7)  — screenshot: build + running container

```bash
docker build -f Dockerfile.final-project -t sentinel-xdr-final:v1 .
docker run -d -p 8000:8000 --name sentinel-dl sentinel-xdr-final:v1
docker ps                                            # running container
curl -s http://localhost:8000/health                 # prediction works in-container
docker logs sentinel-dl | tail
# (or one command):  docker compose -f docker-compose.final.yml up --build
```

## 4. Git + GitHub (rubric §8)  — screenshot: repo + commit history

```bash
git add src training deployment data kubernetes models artifacts \
        requirements-*.txt Dockerfile.final-project docker-compose.final.yml \
        README_FINAL_PROJECT.md docs/requirements_explanation.md \
        docs/commands_for_screenshots.md .github/workflows/final-project-ci.yml
git commit -m "Add Deep Learning IDS final project (models, MLflow, API, Docker, k8s, CI)"
git push origin main
git log --oneline -10                                # commit history screenshot
```

## 5. CI/CD — GitHub Actions (rubric §9)  — screenshot: green pipeline

```text
On GitHub: repo -> Actions tab -> "final-project-ci" -> latest run (all green).
Trigger manually with the "Run workflow" button (workflow_dispatch) if needed.
```

## 6. Kubernetes / Minikube (rubric §10)  — screenshots: pods + services + deployment

```bash
minikube start
eval $(minikube docker-env)                          # build into Minikube's daemon
docker build -f Dockerfile.final-project -t sentinel-xdr-final:v1 .

kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml

kubectl get deployments                              # screenshot
kubectl get pods                                     # screenshot (Running)
kubectl get services                                 # screenshot
minikube service sentinel-xdr-dl-service --url       # get the external URL
curl -s $(minikube service sentinel-xdr-dl-service --url)/health

# Optional:
minikube dashboard                                   # GUI screenshot
```

## 7. Final prediction output (rubric: final application output)

Use the `/predict` curl from step 2 against the Kubernetes service URL, and
screenshot the JSON showing `"label_name": "attack"` with a high
`attack_probability`.
