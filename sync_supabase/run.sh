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
  printf '[run] Creato .env — inserisci la password Supabase in SUPABASE_DATABASE_URL\n'
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export PYTHONPATH=.

exec .venv/bin/python -m sync_supabase "$@"
