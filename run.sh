#!/usr/bin/env bash
# Dev runner: starts the FastAPI backend and the Vite frontend.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Backend setup"
cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
echo "==> Starting backend on http://127.0.0.1:8000"
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACK_PID=$!

echo "==> Frontend setup"
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
echo "==> Starting frontend on http://127.0.0.1:5173"
npm run dev

kill $BACK_PID 2>/dev/null || true
