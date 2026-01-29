# BugAnalyzer

This repository contains a small frontend (static) and a FastAPI backend for analyzing code.

Project structure
- `frontend/` — static files (HTML, CSS, JS)
- `backend/` — FastAPI app (`main.py`) and `requirements.txt`

Key changes for Vercel deployment
- Backend is routed under `/api/analyze` in `vercel.json`.
- Frontend calls the API at `/api/analyze`.

Is `.venv` required?
- No. `.venv` is a local virtual environment for development and should NOT be committed. `.gitignore` excludes it.

Local development
1. Create and activate venv
```bash
python3 -m venv .venv
source .venv/bin/activate
```
2. Install backend deps and run server
```bash
pip install -r backend/requirements.txt
pip install uvicorn
uvicorn backend.main:app --reload --port 8000
```
3. Serve frontend locally (optional)
```bash
# from repo root
python3 -m http.server 5500 --directory frontend
```
Open `http://localhost:5500/index.html` and ensure `script.js` points to `http://localhost:8000/api/analyze` if testing cross-origin.

Deploying to Vercel

Option A — GitHub (recommended)
- Push this repo to GitHub.
- In Vercel, import project from GitHub. Vercel will use `vercel.json` to build and route the app.

Option B — Vercel CLI
```bash
npm i -g vercel
vercel login
vercel
```

Post-deploy checks
- Visit the deployed site root to confirm the frontend loads.
- Test the analyze endpoint:
```bash
curl -X POST <YOUR_VERCEL_URL>/api/analyze -H "Content-Type: application/json" \
  -d '{"code":"print(\"hi\")","language":"python"}'
```

Recommended environment variables
- This app does not require secrets by default. If you later add integrations (APIs, DBs), store secrets in Vercel Environment Variables (Project Settings).
- Useful variables you might add later:
  - `BUGANALYZER_SENTRY_DSN` — for Sentry error reporting
  - `BUGANALYZER_API_KEY` — if you gate functionality

If you want, I can also:
- Add a small GitHub Action to run basic checks before deploy.
- Move the backend into `api/` directory (Vercel functions) instead of routing via `vercel.json`.