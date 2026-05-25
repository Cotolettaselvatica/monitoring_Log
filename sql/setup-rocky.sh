#!/usr/bin/env bash
# Alias di fix-postgres-rocky.sh (install + configurazione completa)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/fix-postgres-rocky.sh" "$@"
