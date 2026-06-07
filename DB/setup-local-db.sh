#!/usr/bin/env bash
# Setup e popolamento PostgreSQL locale (Postgres.app o installazione nativa).
# Uso:
#   ./setup-local-db.sh           # crea DB, schema e dati di test
#   ./setup-local-db.sh --reset   # svuota tabelle e ripopola
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-raspberry_counter}"
DB_USER="${DB_USER:-counter}"
DB_PASSWORD="${DB_PASSWORD:-CatisPg2026}"
ADMIN_USER="${ADMIN_USER:-$(whoami)}"
ADMIN_USER_QUOTED="\"${ADMIN_USER}\""

RESET=0
if [[ "${1:-}" == "--reset" ]]; then
  RESET=1
fi

PSQL="${PSQL:-}"
if [[ -z "$PSQL" ]]; then
  if [[ -x "/Applications/Postgres.app/Contents/Versions/latest/bin/psql" ]]; then
    PSQL="/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
  elif command -v psql >/dev/null 2>&1; then
    PSQL="$(command -v psql)"
  else
    printf '[setup-local-db] ERRORE: psql non trovato\n' >&2
    exit 1
  fi
fi

log() { printf '[setup-local-db] %s\n' "$*"; }
die() { printf '[setup-local-db] ERRORE: %s\n' "$*" >&2; exit 1; }

psql_admin() {
  "$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$1" -v ON_ERROR_STOP=1 "${@:2}"
}

db_exists() {
  psql_admin postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -qx 1
}

role_exists() {
  psql_admin postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -qx 1
}

log "Client: $PSQL"
log "Admin:  ${ADMIN_USER}@${DB_HOST}:${DB_PORT}"

if ! db_exists; then
  log "Creo database ${DB_NAME} ..."
  psql_admin postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${ADMIN_USER_QUOTED};"
else
  log "Database ${DB_NAME} gia' presente"
fi

if ! role_exists; then
  log "Creo utente ${DB_USER} ..."
  psql_admin postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
else
  log "Aggiorno password utente ${DB_USER} ..."
  psql_admin postgres -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
fi

psql_admin postgres -c "GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};"
psql_admin "$DB_NAME" -c "GRANT USAGE ON SCHEMA public TO ${DB_USER};"

log "Applico schema produzione ..."
psql_admin "$DB_NAME" -f "${ROOT}/init/01-conteggi_pezzi.sql"

log "Applico schema dashboard ..."
psql_admin "$DB_NAME" -f "${ROOT}/init/02-dashboard.sql"

psql_admin "$DB_NAME" <<EOSQL
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ${DB_USER};
EOSQL

if [[ "$RESET" -eq 1 ]]; then
  log "Reset dati di test ..."
  psql_admin "$DB_NAME" <<'EOSQL'
TRUNCATE conteggi_pezzi RESTART IDENTITY;
TRUNCATE dashboard_notes, dashboard_alerts, dashboard_maintenance,
         dashboard_report_schedules, dashboard_report_templates,
         dashboard_audit RESTART IDENTITY CASCADE;
TRUNCATE dashboard_macchinari RESTART IDENTITY CASCADE;
EOSQL
fi

log "Popolo dati di test ..."
psql_admin "$DB_NAME" -f "${ROOT}/init/03-seed-test-data.sql"

log "Verifica ..."
psql_admin "$DB_NAME" -c \
  "SELECT COUNT(*) AS conteggi FROM conteggi_pezzi;"
psql_admin "$DB_NAME" -c \
  "SELECT COUNT(*) AS macchinari FROM dashboard_macchinari;"
psql_admin "$DB_NAME" -c \
  "SELECT id, nome_macchinario, nome_pezzo, timestamp FROM conteggi_pezzi ORDER BY timestamp DESC LIMIT 5;"

PGPASSWORD="$DB_PASSWORD" "$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1 AS login_counter_ok;' >/dev/null \
  || die "Login fallito per utente ${DB_USER}"

cat <<EOF

Setup completato.

  host     : ${DB_HOST}
  port     : ${DB_PORT}
  database : ${DB_NAME}
  user     : ${DB_USER}
  password : ${DB_PASSWORD}

Backend (Log_dashboard/backend/.env):

  DB_HOST=${DB_HOST}
  DB_PORT=${DB_PORT}
  DB_NAME=${DB_NAME}
  DB_USER=${DB_USER}
  DB_PASSWORD=${DB_PASSWORD}

Test:
  LOCAL=1 ${ROOT}/test-db.sh

EOF
