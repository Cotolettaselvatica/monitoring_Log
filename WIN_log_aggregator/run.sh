#!/usr/bin/env bash
# Avvio manuale (senza systemd)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${AGGREGATOR_ENV:-${SCRIPT_DIR}/.env}"

cd "$SCRIPT_DIR"

if [[ ! -d ".venv" ]]; then
    echo "Virtualenv non trovato. Esegui prima: ./install.sh" >&2
    exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
    export AGGREGATOR_ENV="$ENV_FILE"
fi

export AGGREGATOR_BASE_DIR="${AGGREGATOR_BASE_DIR:-$SCRIPT_DIR}"

exec .venv/bin/python -m aggregator.main
