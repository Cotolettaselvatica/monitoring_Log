#!/usr/bin/env bash
# Avvio/stop PostgreSQL in container Proxmox LXC (senza systemd)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_SERVICE="postgresql"
PG_DATA=""
# shellcheck source=postgres-lib.sh
source "${SCRIPT_DIR}/postgres-lib.sh"

log() { printf '[postgres] %s\n' "$*"; }
die() { printf '[postgres] ERRORE: %s\n' "$*" >&2; exit 1; }

detect_data_dir() {
    if [[ -f /var/lib/pgsql/data/postgresql.conf ]]; then
        PG_DATA="/var/lib/pgsql/data"
    else
        local conf
        conf="$(find /var/lib/pgsql -maxdepth 3 -name postgresql.conf 2>/dev/null | head -1 || true)"
        PG_DATA="${conf%/postgresql.conf}"
    fi
    [[ -n "$PG_DATA" ]] || die "Directory dati PostgreSQL non trovata"
}

cmd_start() {
    detect_data_dir
    mkdir -p "${PG_DATA}/log"
    chown -R postgres:postgres /var/lib/pgsql 2>/dev/null || true
    start_postgres || die "Impossibile avviare PostgreSQL"
}

cmd_stop() {
    detect_data_dir
    stop_postgres || true
    if postgres_is_running; then
        die "PostgreSQL ancora in esecuzione"
    fi
    log "PostgreSQL fermato"
}

cmd_status() {
    detect_data_dir
    if postgres_is_running; then
        log "PostgreSQL IN ESECUZIONE"
        postgres_status_details
        run_as_postgres psql -c "SELECT version();" 2>/dev/null || true
        return 0
    fi

    log "PostgreSQL NON in esecuzione (secondo i controlli combinati)"
    postgres_status_details
    exit 1
}

case "${1:-start}" in
    start) cmd_start ;;
    stop) cmd_stop ;;
    status) cmd_status ;;
    restart) cmd_stop; cmd_start ;;
    *) echo "Uso: $0 {start|stop|status|restart}"; exit 1 ;;
esac
