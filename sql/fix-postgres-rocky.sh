#!/usr/bin/env bash
# Installa e configura PostgreSQL su Rocky Linux / container Proxmox LXC
# Esegui: sudo ./fix-postgres-rocky.sh
# Opzionale: sudo DB_PASSWORD='secret' ./fix-postgres-rocky.sh
set -euo pipefail

DB_NAME="${DB_NAME:-raspberry_counter}"
DB_USER="${DB_USER:-contatore}"
DB_PASSWORD="${DB_PASSWORD:-}"
PG_SERVICE="postgresql"
PG_DATA=""
SCHEMA_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/schema.sql"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=postgres-lib.sh
source "${SCRIPT_DIR}/postgres-lib.sh"

log() { printf '[fix-postgres] %s\n' "$*"; }
die() { printf '[fix-postgres] ERRORE: %s\n' "$*" >&2; exit 1; }

require_root() {
    [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Esegui con sudo"
}

prompt_password() {
    if [[ -n "$DB_PASSWORD" ]]; then
        return
    fi
    read -r -s -p "Password per utente PostgreSQL '${DB_USER}': " DB_PASSWORD
    echo
    [[ -n "$DB_PASSWORD" ]] || die "Password obbligatoria"
}

install_packages() {
    if command -v postgres >/dev/null 2>&1 && command -v postgresql-setup >/dev/null 2>&1; then
        log "PostgreSQL gia' installato"
        return
    fi
    log "Installo PostgreSQL (postgresql-server)..."
    dnf install -y postgresql-server postgresql-contrib
}

detect_service() {
    if systemctl list-unit-files "${PG_SERVICE}.service" --no-legend 2>/dev/null | grep -q .; then
        return
    fi
    local candidate
    candidate="$(systemctl list-unit-files 'postgresql*.service' --no-legend 2>/dev/null | awk '{print $1}' | head -1)"
    [[ -n "$candidate" ]] || die "Servizio PostgreSQL non trovato dopo l'installazione"
    PG_SERVICE="${candidate%.service}"
    log "Servizio: ${PG_SERVICE}"
}

detect_data_dir() {
    PG_DATA=""
    if [[ -f /var/lib/pgsql/data/postgresql.conf ]]; then
        PG_DATA="/var/lib/pgsql/data"
    else
        local conf
        conf="$(find /var/lib/pgsql -maxdepth 3 -name postgresql.conf 2>/dev/null | head -1 || true)"
        PG_DATA="${conf%/postgresql.conf}"
    fi
}

init_cluster_if_missing() {
    detect_data_dir

    if [[ -n "$PG_DATA" && -d "$PG_DATA" && ! -f "${PG_DATA}/PG_VERSION" ]]; then
        log "Directory dati incompleta, la ricreo..."
        rm -rf "$PG_DATA"
        PG_DATA=""
    fi

    if [[ -n "$PG_DATA" && -f "${PG_DATA}/PG_VERSION" ]]; then
        log "Cluster PostgreSQL gia' inizializzato"
        log "Data directory: ${PG_DATA}"
        return
    fi

    log "Cluster assente, eseguo initdb..."
    postgresql-setup --initdb --unit "${PG_SERVICE}" 2>/dev/null \
        || postgresql-setup --initdb
    detect_data_dir
    [[ -n "$PG_DATA" && -f "${PG_DATA}/postgresql.conf" ]] || die "Directory dati PostgreSQL non trovata"
    log "Data directory: ${PG_DATA}"
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

configure_firewall() {
    if systemctl is-active --quiet firewalld 2>/dev/null; then
        log "Apro porta 5432/tcp su firewalld..."
        firewall-cmd --permanent --add-service=postgresql
        firewall-cmd --reload
    else
        log "firewalld non attivo, salto configurazione firewall"
    fi
}

setup_database() {
    log "Creo database, utente e schema..."

    if ! run_as_postgres psql -v ON_ERROR_STOP=1 -tAc \
        "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
        run_as_postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
    fi

    # Dollar-quoting ($pwd$...$pwd$) + espansione ${DB_PASSWORD}: sicuro con $ e ! nella password
    run_as_postgres psql -v ON_ERROR_STOP=1 <<EOSQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD \$pwd\$${DB_PASSWORD}\$pwd\$;
    ELSE
        ALTER ROLE ${DB_USER} WITH PASSWORD \$pwd\$${DB_PASSWORD}\$pwd\$;
    END IF;
END
\$\$;
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL

    run_as_postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCHEMA_FILE"

    run_as_postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<EOSQL
GRANT INSERT, SELECT ON conteggi_pezzi TO ${DB_USER};
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO ${DB_USER};
EOSQL
}

verify_database_setup() {
    log "Verifico utente, database e tabella..."
    run_as_postgres psql -v ON_ERROR_STOP=1 -tAc \
        "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1 \
        || die "Utente ${DB_USER} non creato"
    run_as_postgres psql -v ON_ERROR_STOP=1 -tAc \
        "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 \
        || die "Database ${DB_NAME} non creato"
    run_as_postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -tAc \
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'conteggi_pezzi'" | grep -q 1 \
        || die "Tabella conteggi_pezzi non creata"
    log "Verifica OK: utente, database e tabella presenti"
}

start_service() {
    if ! start_postgres; then
        printf '\n[fix-postgres] Diagnostica:\n' >&2
        systemctl status "${PG_SERVICE}" --no-pager -l 2>/dev/null || true
        journalctl -u "${PG_SERVICE}" -n 30 --no-pager 2>/dev/null || true
        tail -30 "${PG_DATA}/log/postgresql.log" 2>/dev/null || true
        die "PostgreSQL non avviato. Prova: sudo ./start-postgres.sh start"
    fi
    install_container_autostart "${SCRIPT_DIR}/start-postgres.sh"
}

show_summary() {
    local ip listen
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    listen="$(detect_listen_addresses)"
    cat <<EOF

Setup completato.

Database : ${DB_NAME}
Utente   : ${DB_USER}
Porta    : 5432
Listen   : ${listen}
Servizio : ${PG_SERVICE}

Configura i Raspberry (.env):
  DB_HOST=${ip:-IP_DEL_CONTAINER}
  DB_PORT=5432
  DB_NAME=${DB_NAME}
  DB_USER=${DB_USER}
  DB_PASSWORD=<la password scelta>

Entra in PostgreSQL:
  sudo -u postgres psql -d ${DB_NAME}
  psql -U ${DB_USER} -d ${DB_NAME} -h 127.0.0.1 -W

Verifica:
  sudo ./start-postgres.sh status

EOF
}

main() {
    require_root
    prompt_password
    install_packages
    detect_service
    init_cluster_if_missing
    fix_permissions
    fix_selinux
    fix_logging_collector
    set_listen_addresses
    write_pg_hba_file
    validate_postgres_config
    start_service
    configure_firewall
    setup_database
    verify_database_setup
    show_summary
}

main "$@"
