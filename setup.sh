#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== AutoRisk Premium Optimizer Setup ==="

# ── Backend ──────────────────────────────────────────────────────────────────
echo ""
echo "--- Setting up backend ---"
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate

echo "Upgrading pip..."
pip install --upgrade pip

echo "Installing backend dependencies..."
pip install -r requirements.txt

echo "Backend dependencies installed."
deactivate

# ── Frontend ─────────────────────────────────────────────────────────────────
echo ""
echo "--- Setting up frontend ---"
cd "$SCRIPT_DIR/frontend"

if ! command -v yarn &> /dev/null; then
  echo "yarn not found. Installing via npm..."
  npm install -g yarn
fi

echo "Installing frontend dependencies..."
yarn install
echo "Frontend dependencies installed."

# ── Start both ───────────────────────────────────────────────────────────────
echo ""
echo "=== Starting AutoRisk Premium Optimizer ==="
echo "  Backend  → http://localhost:8002  (API docs: http://localhost:8002/docs)"
echo "  Frontend → http://localhost:3000"
echo ""
echo "  Default credentials:"
echo "    admin@autorisk.com          / admin123"
echo "    underwriter@autorisk.com    / pass123"
echo "    agent@autorisk.com          / pass123"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start backend
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8002 &
BACKEND_PID=$!

# Start frontend
cd "$SCRIPT_DIR/frontend"
BROWSER=none yarn start &
FRONTEND_PID=$!

# Trap Ctrl+C and kill both
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM

wait "$BACKEND_PID" "$FRONTEND_PID"
