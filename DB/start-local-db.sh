#!/usr/bin/env bash
# PostgreSQL locale per test (Docker).
# Uso:
#   ./start-local-db.sh start    # avvia container
#   ./start-local-db.sh stop     # ferma container
#   ./start-local-db.sh reset    # cancella dati e ricrea tutto
#   ./start-local-db.sh status   # stato container
#   ./start-local-db.sh test     # test connessione + conteggi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-raspberry_counter}"
DB_USER="${DB_USER:-counter}"
DB_PASSWORD="${DB_PASSWORD:-CatisPg2026}"

log() { printf '[local-db] %s\n' "$*"; }
die() { printf '[local-db] ERRORE: %s\n' "$*" >&2; exit 1; }

require_docker() {
    command -v docker >/dev/null 2>&1 || die "Docker non trovato"
    docker info >/dev/null 2>&1 || die "Docker non in esecuzione"
}

cmd_start() {
    require_docker
    log "Avvio PostgreSQL locale su ${DB_HOST}:${DB_PORT} ..."
    DB_PORT="$DB_PORT" docker compose up -d
    log "Attendo healthcheck ..."
    for _ in $(seq 1 30); do
        if docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
            log "PostgreSQL pronto"
            log ""
            log "Connessione:"
            log "  host=${DB_HOST} port=${DB_PORT} db=${DB_NAME} user=${DB_USER} password=${DB_PASSWORD}"
            log ""
            log "Backend (.env):"
            log "  DB_HOST=${DB_HOST}"
            log "  DB_PORT=${DB_PORT}"
            log "  DB_NAME=${DB_NAME}"
            log "  DB_USER=${DB_USER}"
            log "  DB_PASSWORD=${DB_PASSWORD}"
            return 0
        fi
        sleep 1
    done
    die "Timeout avvio PostgreSQL"
}

cmd_stop() {
    require_docker
    log "Arresto container ..."
    docker compose down
    log "Fermato"
}

cmd_reset() {
    require_docker
    log "Reset database (cancellazione volume) ..."
    docker compose down -v
    cmd_start
    cmd_test
}

cmd_status() {
    require_docker
    docker compose ps
}

cmd_test() {
    if command -v psql >/dev/null 2>&1; then
        DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_PASSWORD="$DB_PASSWORD" "$ROOT/test-db.sh"
        return
    fi
    require_docker
    log "psql non installato, uso docker exec ..."
    docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1 AS ok;'
    docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
        'SELECT id, nome_macchinario, nome_pezzo, timestamp FROM conteggi_pezzi ORDER BY timestamp DESC LIMIT 5;'
    log "Connessione OK"
}

ACTION="${1:-start}"
case "$ACTION" in
    start) cmd_start ;;
    stop) cmd_stop ;;
    reset) cmd_reset ;;
    status) cmd_status ;;
    test) cmd_test ;;
    *)
        die "Azione sconosciuta: $ACTION (usa: start|stop|reset|status|test)"
        ;;
esac
