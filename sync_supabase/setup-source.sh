#!/usr/bin/env bash
# Prepara tabella stato sync sul database sorgente (LAN).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SOURCE_DB_HOST="${SOURCE_DB_HOST:-127.0.0.1}"
SOURCE_DB_PORT="${SOURCE_DB_PORT:-5432}"
SOURCE_DB_NAME="${SOURCE_DB_NAME:-raspberry_counter}"
SOURCE_DB_USER="${SOURCE_DB_USER:-$(whoami)}"

PSQL="${PSQL:-}"
if [[ -x "/Applications/Postgres.app/Contents/Versions/latest/bin/psql" ]]; then
  PSQL="/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
elif command -v psql >/dev/null 2>&1; then
  PSQL="$(command -v psql)"
else
  printf '[setup-source] ERRORE: psql non trovato\n' >&2
  exit 1
fi

printf '[setup-source] Applico sync_supabase_state su %s...\n' "$SOURCE_DB_NAME"
"$PSQL" -h "$SOURCE_DB_HOST" -p "$SOURCE_DB_PORT" -U "$SOURCE_DB_USER" -d "$SOURCE_DB_NAME" \
  -v ON_ERROR_STOP=1 -f "${ROOT}/sql/source_sync_state.sql"

cat <<'EOSQL' | "$PSQL" -h "$SOURCE_DB_HOST" -p "$SOURCE_DB_PORT" -U "$SOURCE_DB_USER" -d "$SOURCE_DB_NAME" -v ON_ERROR_STOP=1
GRANT SELECT ON ALL TABLES IN SCHEMA public TO counter;
GRANT SELECT, INSERT, UPDATE ON sync_supabase_state TO counter;
EOSQL

printf '[setup-source] OK\n'
