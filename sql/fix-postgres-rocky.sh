#!/usr/bin/env bash
# Ripara avvio PostgreSQL su Rocky Linux (exit-code)
# Esegui: sudo ./fix-postgres-rocky.sh
set -euo pipefail

PG_SERVICE="postgresql"
PG_DATA=""
PG_HBA_MARKER="# Industria 5.0 - tutte le subnet"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=postgres-lib.sh
source "${SCRIPT_DIR}/postgres-lib.sh"

log() { printf '[fix-postgres] %s\n' "$*"; }
die() { printf '[fix-postgres] ERRORE: %s\n' "$*" >&2; exit 1; }

require_root() {
    [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Esegui con sudo"
}

detect_service() {
    if systemctl list-unit-files "${PG_SERVICE}.service" --no-legend 2>/dev/null | grep -q .; then
        return
    fi
    local candidate
    candidate="$(systemctl list-unit-files 'postgresql*.service' --no-legend 2>/dev/null | awk '{print $1}' | head -1)"
    [[ -n "$candidate" ]] || die "Servizio PostgreSQL non trovato"
    PG_SERVICE="${candidate%.service}"
    log "Servizio: ${PG_SERVICE}"
}

detect_data_dir() {
    if [[ -f /var/lib/pgsql/data/postgresql.conf ]]; then
        PG_DATA="/var/lib/pgsql/data"
    else
        local conf
        conf="$(find /var/lib/pgsql -maxdepth 3 -name postgresql.conf 2>/dev/null | head -1 || true)"
        PG_DATA="${conf%/postgresql.conf}"
    fi
    [[ -n "$PG_DATA" && -f "${PG_DATA}/postgresql.conf" ]] || die "postgresql.conf non trovato"
    log "Data directory: ${PG_DATA}"
}

init_cluster_if_missing() {
    if [[ -f "${PG_DATA}/PG_VERSION" ]]; then
        return
    fi
    log "Cluster assente, eseguo initdb..."
    if [[ -d "$PG_DATA" ]]; then
        rm -rf "$PG_DATA"
    fi
    postgresql-setup --initdb --unit "${PG_SERVICE}" 2>/dev/null \
        || postgresql-setup --initdb
    detect_data_dir
}

fix_permissions() {
    log "Riparo permessi..."
    mkdir -p "${PG_DATA}/log"
    chown -R postgres:postgres /var/lib/pgsql
    chmod 700 "${PG_DATA}"
    chmod 600 "${PG_DATA}/postgresql.conf" "${PG_DATA}/pg_hba.conf" 2>/dev/null || true
    chmod 700 "${PG_DATA}/log"
}

fix_selinux() {
    if command -v restorecon >/dev/null 2>&1; then
        log "Ripristino contesto SELinux..."
        restorecon -Rv /var/lib/pgsql >/dev/null 2>&1 || true
    fi
    if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce 2>/dev/null)" != "Disabled" ]]; then
        setsebool -P postgresql_can_network_connect on 2>/dev/null || true
    fi
}

fix_logging() {
    local pg_conf="${PG_DATA}/postgresql.conf"
    if grep -q "^[[:space:]]*logging_collector[[:space:]]*=[[:space:]]*on" "$pg_conf"; then
        log "Trovato logging_collector=on, verifico directory log..."
        mkdir -p "${PG_DATA}/log"
        chown postgres:postgres "${PG_DATA}/log"
        chmod 700 "${PG_DATA}/log"
    fi
}

set_listen_addresses() {
    local pg_conf="${PG_DATA}/postgresql.conf"
    local tmp
    tmp="$(mktemp)"
    awk '
        BEGIN { done = 0 }
        /^[[:space:]]*#/ && /listen_addresses/ { print "listen_addresses = '\''*'\''"; done = 1; next }
        /^[[:space:]]*listen_addresses/ { if (!done) { print "listen_addresses = '\''*'\''"; done = 1 }; next }
        { print }
        END { if (!done) print "listen_addresses = '\''*'\''" }
    ' "$pg_conf" >"$tmp"
    mv "$tmp" "$pg_conf"
    chown postgres:postgres "$pg_conf"
    chmod 600 "$pg_conf"
}

fix_pg_hba() {
    local hba_conf="${PG_DATA}/pg_hba.conf"
    local tmp
    tmp="$(mktemp)"

    log "Ripulisco e riscrivo regole rete in pg_hba.conf..."
    grep -vF "${PG_HBA_MARKER}" "$hba_conf" | grep -vE '^host[[:space:]]+all[[:space:]]+all[[:space:]]+(0\.0\.0\.0/0|::/0)' >"$tmp" || true

    if [[ ! -s "$tmp" ]]; then
        cat >"$tmp" <<'EOF'
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
EOF
    fi

    cat >>"$tmp" <<EOF

${PG_HBA_MARKER}
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                      scram-sha-256
EOF

    mv "$tmp" "$hba_conf"
    chown postgres:postgres "$hba_conf"
    chmod 600 "$hba_conf"
}

validate_config() {
    local postgres_bin
    postgres_bin="$(command -v postgres || die "postgres non trovato")"
    log "Verifico configurazione..."
    if ! sudo -u postgres "$postgres_bin" -D "$PG_DATA" --check-config; then
        die "Configurazione non valida"
    fi
}

try_pg_ctl() {
    local pg_ctl
    pg_ctl="$(command -v pg_ctl || true)"
    [[ -n "$pg_ctl" ]] || return 0

    log "Test avvio diretto con pg_ctl..."
    if ! sudo -u postgres "$pg_ctl" status -D "$PG_DATA" >/dev/null 2>&1; then
        if ! sudo -u postgres "$pg_ctl" start -D "$PG_DATA" -w -t 20 -l "${PG_DATA}/log/manual-start.log"; then
            log "pg_ctl fallito. Ultimo log:"
            tail -30 "${PG_DATA}/log/manual-start.log" 2>/dev/null || true
            return 1
        fi
        sudo -u postgres "$pg_ctl" stop -D "$PG_DATA" -w -t 20 || true
    fi
    return 0
}

start_service() {
    if ! start_postgres; then
        printf '\n[fix-postgres] Diagnostica:\n' >&2
        systemctl status "${PG_SERVICE}" --no-pager -l 2>/dev/null || true
        journalctl -u "${PG_SERVICE}" -n 30 --no-pager 2>/dev/null || true
        tail -30 "${PG_DATA}/log/postgresql.log" 2>/dev/null || true
        die "PostgreSQL ancora non parte. Prova: sudo ./start-postgres.sh"
    fi
    install_container_autostart "${SCRIPT_DIR}/start-postgres.sh"
    log "Fix completato."
}

main() {
    require_root
    detect_service
    detect_data_dir
    init_cluster_if_missing
    fix_permissions
    fix_selinux
    fix_logging
    set_listen_addresses
    fix_pg_hba
    validate_config
    try_pg_ctl || true
    start_service
    log "Verifica: sudo ./start-postgres.sh status"
}

main "$@"
