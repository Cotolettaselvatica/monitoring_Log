#!/usr/bin/env bash
# Applica lo schema mirror su Supabase.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

URL="${SUPABASE_DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  printf '[apply-supabase-schema] ERRORE: imposta SUPABASE_DATABASE_URL in .env\n' >&2
  exit 1
fi

PSQL="${PSQL:-}"
if [[ -z "$PSQL" ]]; then
  if [[ -x "/Applications/Postgres.app/Contents/Versions/latest/bin/psql" ]]; then
    PSQL="/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
  elif command -v psql >/dev/null 2>&1; then
    PSQL="$(command -v psql)"
  else
    printf '[apply-supabase-schema] ERRORE: psql non trovato\n' >&2
    exit 1
  fi
fi

printf '[apply-supabase-schema] Applico schema su Supabase...\n'
"$PSQL" "$URL" -v ON_ERROR_STOP=1 -f "${ROOT}/sql/supabase_schema.sql"
printf '[apply-supabase-schema] Schema applicato\n'
