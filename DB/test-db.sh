#!/usr/bin/env bash
# Test connessione PostgreSQL (Raspberry Pi, server o Postgres locale).
# Uso: ./test-db.sh
#      LOCAL=1 ./test-db.sh                    # localhost (Postgres.app)
#      DB_HOST=172.20.1.84 ./test-db.sh        # server produzione
set -euo pipefail

if [[ "${LOCAL:-0}" == "1" ]]; then
  DB_HOST="${DB_HOST:-127.0.0.1}"
else
  DB_HOST="${DB_HOST:-172.20.1.84}"
fi
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-raspberry_counter}"
DB_USER="${DB_USER:-counter}"
DB_PASSWORD="${DB_PASSWORD:-CatisPg2026}"

log() { printf '[test-db] %s\n' "$*"; }
die() { printf '[test-db] ERRORE: %s\n' "$*" >&2; exit 1; }

command -v psql >/dev/null 2>&1 || die "Installa il client: sudo apt install -y postgresql-client"

log "Test ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} ..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1 AS ok;'

log "Ultimi conteggi:"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    'SELECT id, nome_macchinario, nome_pezzo, timestamp FROM conteggi_pezzi ORDER BY timestamp DESC LIMIT 5;'

log "Connessione OK"
