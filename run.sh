#!/usr/bin/env bash
#
# Lao Gan Ma — one-command runner.
#
#   ./run.sh            install deps (if missing) + start backend & frontend
#   ./run.sh --install  install all dependencies only, then exit
#   ./run.sh --force    reinstall all dependencies, then start
#
# Backend  -> http://127.0.0.1:8000  (API, docs at /docs)
# Frontend -> http://127.0.0.1:5173  (open this in your browser)
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

INSTALL_ONLY=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL_ONLY=1 ;;
    --force)   FORCE=1 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ---- pre-flight ------------------------------------------------------------
command -v python3 >/dev/null || { echo "ERROR: python3 not found"; exit 1; }
command -v npm     >/dev/null || { echo "ERROR: npm not found (install Node.js)"; exit 1; }

# ---- install dependencies --------------------------------------------------
echo "==> [1/2] Backend dependencies"
cd "$BACKEND"
if [ "$FORCE" -eq 1 ]; then rm -rf .venv; fi
if [ ! -d .venv ]; then
  echo "    creating virtualenv (.venv)"
  python3 -m venv .venv
fi
echo "    installing Python packages"
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

echo "==> [2/2] Frontend dependencies"
cd "$FRONTEND"
if [ "$FORCE" -eq 1 ]; then rm -rf node_modules; fi
if [ ! -d node_modules ]; then
  echo "    running npm install"
  npm install --no-fund --no-audit
else
  echo "    node_modules present (use --force to reinstall)"
fi

if [ "$INSTALL_ONLY" -eq 1 ]; then
  echo ""
  echo "✅ All dependencies installed. Run './run.sh' to start the app."
  exit 0
fi

# ---- PRODUCTION (Render etc.): one process, one port -----------------------
# When $PORT is set we are in a hosted single-service environment. Build the
# frontend once, then run a single uvicorn bound to 0.0.0.0:$PORT so the host's
# port scanner can see us. FastAPI serves both /api and the built React app.
if [ -n "${PORT:-}" ]; then
  echo ""
  echo "==> Production mode detected (PORT=$PORT)"
  echo "==> Building frontend"
  cd "$FRONTEND"
  npm run build
  echo "==> Starting server -> 0.0.0.0:$PORT (API + frontend)"
  cd "$BACKEND"
  exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
fi

# ---- LOCAL DEV: two servers with clean shutdown ----------------------------
BACK_PID=""
cleanup() {
  echo ""
  echo "==> Shutting down..."
  [ -n "$BACK_PID" ] && kill "$BACK_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "==> Starting backend  -> http://127.0.0.1:8000"
cd "$BACKEND"
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACK_PID=$!

# give the backend a moment to bind
sleep 2
if ! kill -0 "$BACK_PID" 2>/dev/null; then
  echo "ERROR: backend failed to start"; exit 1
fi

echo "==> Starting frontend -> http://127.0.0.1:5173  (open this)"
echo "    (press Ctrl+C to stop both)"
cd "$FRONTEND"
npm run dev   # runs in foreground; cleanup() stops the backend on exit
