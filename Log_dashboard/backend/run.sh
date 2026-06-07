#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  PYTHON="${PYTHON:-python3.11}"
  command -v "$PYTHON" >/dev/null 2>&1 || PYTHON=python3
  "$PYTHON" -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "[run] Creato .env da .env.example — verifica DB_HOST e credenziali"
fi

set -a
source .env
set +a

export PYTHONPATH=.

exec .venv/bin/uvicorn app.main:app --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}" --reload
