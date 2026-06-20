---
title: Sentinel XDR DL IDS
emoji: 🛡️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Sentinel XDR — Deep Learning IDS API

Serves the trained Keras intrusion-detection model (binary: normal vs attack)
over network-flow features. This Space hosts the model-serving FastAPI from the
[`sentinel-xdr`](https://github.com/Obaiz1/sentinel-xdr) Deep Learning final project.

**Endpoints**
- `GET /` — service metadata + feature schema
- `GET /health` — model/preprocessor readiness
- `POST /predict` — classify one or more flows
- `GET /docs` — interactive Swagger UI

Example:
```bash
curl -X POST $SPACE_URL/predict -H "Content-Type: application/json" \
  -d '{"flows":[{"duration":2,"protocol_type":"tcp","service":"private","src_bytes":60,"dst_bytes":40,"count":200,"srv_count":20,"same_srv_rate":0.1}]}'
```
