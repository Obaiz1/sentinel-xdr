# SENTINEL XDR backend — container image (used by Hugging Face Spaces / any Docker host).
# HF Spaces serve on port 7860. Writable paths are redirected to /tmp.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBUG=false \
    LLM_PROVIDER=nvidia \
    NVIDIA_MODEL=meta/llama-3.3-70b-instruct \
    DB_PATH=/tmp/ids_data.db \
    CHROMA_PERSIST_DIR=/tmp/chroma_db \
    HF_HOME=/tmp/hf \
    PORT=7860

WORKDIR /app

# Build tooling for any source wheels (chromadb deps etc.)
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Make /app writable for the runtime user and ensure tmp dirs exist
RUN mkdir -p /tmp/chroma_db /tmp/hf && chmod -R 777 /app /tmp/chroma_db /tmp/hf

EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
