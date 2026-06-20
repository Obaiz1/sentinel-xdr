# Hugging Face Space (Docker SDK) image for the Sentinel XDR DL IDS API.
# HF Spaces serve on port 7860 by default (matches README app_port).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    SENTINEL_DL_MODEL_PATH=/app/models/sentinel_dl_v2.keras \
    HF_HOME=/tmp/hf

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-api.txt ./requirements-api.txt
RUN pip install --upgrade pip && pip install -r requirements-api.txt

COPY src/ ./src/
COPY deployment/ ./deployment/
COPY models/ ./models/
COPY artifacts/ ./artifacts/
COPY data/sample_network_flows.csv ./data/sample_network_flows.csv

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:7860/health || exit 1

CMD ["uvicorn", "deployment.dl_api:app", "--host", "0.0.0.0", "--port", "7860"]
