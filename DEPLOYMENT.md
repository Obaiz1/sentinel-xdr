# SENTINEL XDR — Online Deployment Guide

Frontend → **Vercel** · Backend (FastAPI) → **Render** (or Railway/Fly).
The repo root (this folder) is the **backend**; the Next.js **frontend** is in `sentinel-ui/`.

> ⚠️ Two honest caveats for the cloud backend:
> 1. **Live packet sniffing (Npcap) does NOT work in the cloud.** Everything else does —
>    **Demo Mode**, alerts, statistics, MACE chains, XDR engines, ARIA chat.
> 2. **chromadb (RAG) is RAM-heavy.** Render's **free** plan (512 MB) may OOM on boot.
>    If it crashes with "Out of memory", upgrade to a paid instance (≥1 GB) or use
>    Railway / Fly.io / Hugging Face Spaces (16 GB free Docker).

---

## Prerequisites
- A **GitHub** account (the code must be pushed there — both hosts deploy from git).
- A **Render** account (free) and a **Vercel** account (free).
- An **NVIDIA NIM API key** (`nvapi-…`) from https://build.nvidia.com — required for ARIA.

---

## Step 1 — Push the code to GitHub
This repo (the inner `AI-IDS-main/`, which has the `.git`) currently has **no remote**.
On branch `stitch-ui-integration` (already committed):

```bash
cd AI-IDS-main          # the folder containing main.py + sentinel-ui/
git remote add origin https://github.com/<you>/sentinel-xdr.git
git push -u origin stitch-ui-integration
# (optionally also: git checkout main && git merge stitch-ui-integration && git push)
```

## Step 2 — Deploy the BACKEND on Render
1. Render → **New** → **Blueprint** → connect your GitHub repo. It auto-detects [`render.yaml`](./render.yaml).
2. Before/after first deploy, set the secret env var:
   - `NVIDIA_API_KEY` = your `nvapi-…` key (the blueprint marks it `sync:false` so it isn't in git).
   - (`LLM_PROVIDER=nvidia`, `NVIDIA_MODEL`, `DEBUG=false`, `PYTHON_VERSION=3.12.7` are preset.)
3. Deploy. When live, copy the URL, e.g. `https://sentinel-xdr-backend.onrender.com`.
4. Verify: open `https://…onrender.com/status` → should return JSON. CORS is already `allow_origins=["*"]`.

> Not using the blueprint? Create a **Web Service** manually with:
> Build `pip install -r requirements.txt` · Start `uvicorn main:app --host 0.0.0.0 --port $PORT` ·
> Health check `/status` · Python `3.12.7`.

## Step 3 — Deploy the FRONTEND on Vercel
1. Vercel → **Add New Project** → import the same GitHub repo.
2. **Root Directory** = `sentinel-ui` (important — the app is nested).
3. Framework: **Next.js** (auto). Build/Output: defaults.
4. **Environment Variables** (Production):
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-backend>.onrender.com` |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://<your-backend>.onrender.com` |
   | `NEXT_PUBLIC_UI_VERSION` | `new` |
   > `NEXT_PUBLIC_*` is inlined at **build** time — set these **before** building, and
   > **redeploy** after any change.
5. Deploy. Your site: `https://<project>.vercel.app` (root `/` shows the new Command Center UI;
   `/legacy` and `/new` always force their version).

## Step 4 — Generate data to see it live
The cloud DB starts empty (so panels show clean empty/offline states — by design, no fake data).
On the deployed site → **Control Panel** → **Start Demo**, or:
```bash
curl -X POST https://<your-backend>.onrender.com/api/sniffer/demo/start
```
The Command Center KPIs, Threat Intelligence charts, MACE chains, and Live Alerts then populate.

---

## Notes & troubleshooting
- **Cold starts:** Render's free backend sleeps after ~15 min idle; the first request wakes it
  (~50 s). The frontend shows an offline/Retry state during the wake, then recovers.
- **Backend OOM on free plan:** upgrade the instance RAM (see caveat above).
- **ARIA says offline:** the backend `NVIDIA_API_KEY` is missing/invalid, or the backend is asleep.
- **No secrets in the frontend:** the browser only ever calls the backend; the LLM key lives only
  on the backend host. Never put `NVIDIA_API_KEY` in a `NEXT_PUBLIC_*` var.
- **Alternative backend hosts:** Railway (`railway up`, similar env), Fly.io (`fly launch`, set RAM in
  `fly.toml`), or Hugging Face Spaces (Docker, 16 GB free). Same start command + env vars apply.
