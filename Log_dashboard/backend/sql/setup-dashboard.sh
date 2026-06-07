#!/usr/bin/env bash
# Applica lo schema dashboard su PostgreSQL (stesso DB degli aggregator).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL="$ROOT/sql/schema.sql"

DB_HOST="${DB_HOST:-172.20.1.84}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-raspberry_counter}"
DB_USER="${DB_USER:-counter}"
DB_PASSWORD="${DB_PASSWORD:-CatisPg2026}"

log() { printf '[setup-db] %s\n' "$*"; }
die() { printf '[setup-db] ERRORE: %s\n' "$*" >&2; exit 1; }

command -v psql >/dev/null 2>&1 || die "Installa postgresql-client"

log "Applico schema dashboard su ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL"
log "Schema applicato"
