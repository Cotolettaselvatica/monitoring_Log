#!/usr/bin/env bash
# Setup PostgreSQL su Rocky Linux per contatore pezzi Industria 5.0
# Esegui come root: sudo ./setup-rocky.sh
set -euo pipefail

DB_NAME="${DB_NAME:-raspberry_counter}"
DB_USER="${DB_USER:-contatore}"
DB_PASSWORD="${DB_PASSWORD:-}"
PG_VERSION="${PG_VERSION:-}"          # es. 15 — auto se vuoto
PG_HBA_MARKER="# Industria 5.0 - tutte le subnet"
SCHEMA_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/schema.sql"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=postgres-lib.sh
source "${SCRIPT_DIR}/postgres-lib.sh"
PG_SERVICE="postgresql"
PG_DATA=""

log() { printf '[setup-postgres] %s\n' "$*"; }
die() { printf '[setup-postgres] ERRORE: %s\n' "$*" >&2; exit 1; }

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

detect_pg_setup() {
    if command -v postgresql-setup >/dev/null 2>&1; then
        PG_SETUP="postgresql-setup"
        return
    fi
    die "postgresql-setup non trovato. Installa postgresql-server."
}

detect_service() {
    if systemctl list-unit-files "${PG_SERVICE}.service" --no-legend 2>/dev/null | grep -q .; then
        return
    fi
    local candidate
    candidate="$(systemctl list-unit-files 'postgresql*.service' --no-legend 2>/dev/null | awk '{print $1}' | head -1)"
    [[ -n "$candidate" ]] || die "Servizio systemd PostgreSQL non trovato"
    PG_SERVICE="${candidate%.service}"
    log "Servizio systemd: ${PG_SERVICE}"
}

detect_data_dir() {
    PG_DATA=""
    if [[ -n "$PG_VERSION" && -d "/var/lib/pgsql/${PG_VERSION}/data" ]]; then
        PG_DATA="/var/lib/pgsql/${PG_VERSION}/data"
    elif [[ -d /var/lib/pgsql/data ]]; then
        PG_DATA="/var/lib/pgsql/data"
    else
        local conf
        conf="$(find /var/lib/pgsql -maxdepth 3 -name postgresql.conf 2>/dev/null | head -1 || true)"
        PG_DATA="${conf%/postgresql.conf}"
    fi
}

init_database() {
    detect_pg_setup
    detect_data_dir

    if [[ -n "$PG_DATA" && -d "$PG_DATA" && ! -f "${PG_DATA}/PG_VERSION" ]]; then
        log "Directory dati incompleta, la ricreo..."
        rm -rf "$PG_DATA"
        PG_DATA=""
    fi

    if [[ -z "$PG_DATA" || ! -f "${PG_DATA}/PG_VERSION" ]]; then
        log "Inizializzo cluster PostgreSQL..."
        "$PG_SETUP" --initdb --unit "${PG_SERVICE}" 2>/dev/null \
            || "$PG_SETUP" --initdb
        detect_data_dir
    else
        log "Cluster PostgreSQL gia' inizializzato"
    fi

    [[ -n "$PG_DATA" && -f "${PG_DATA}/postgresql.conf" ]] || die "Directory dati PostgreSQL non trovata"
    log "Data directory: ${PG_DATA}"
}

install_packages() {
    log "Installo PostgreSQL..."
    dnf install -y postgresql-server postgresql-contrib
    detect_service
}

configure_network() {
    log "Configuro ascolto rete e accesso da tutte le subnet..."
    ensure_log_directory
    fix_logging_collector
    set_listen_addresses
    write_pg_hba_file
}

configure_selinux() {
    if command -v restorecon >/dev/null 2>&1; then
        log "Ripristino contesto SELinux su /var/lib/pgsql..."
        restorecon -Rv /var/lib/pgsql >/dev/null 2>&1 || true
    fi
    if ! command -v getenforce >/dev/null 2>&1; then
        return
    fi
    if [[ "$(getenforce 2>/dev/null)" == "Disabled" ]]; then
        return
    fi
    log "Configuro SELinux per PostgreSQL in rete..."
    setsebool -P postgresql_can_network_connect on 2>/dev/null || true
}

fix_filesystem() {
    log "Verifico permessi e directory log..."
    mkdir -p "${PG_DATA}/log"
    chown -R postgres:postgres /var/lib/pgsql
    chmod 700 "${PG_DATA}"
    chmod 700 "${PG_DATA}/log"
}

ensure_log_directory() {
    mkdir -p "${PG_DATA}/log"
    chown postgres:postgres "${PG_DATA}/log"
    chmod 700 "${PG_DATA}/log"
}

validate_config() {
    validate_postgres_config
}

show_startup_failure() {
    printf '\n[setup-postgres] Diagnostica avvio fallito:\n' >&2
    systemctl status "${PG_SERVICE}" --no-pager -l >&2 || true
    printf '\n[setup-postgres] Ultimi log journalctl:\n' >&2
    journalctl -u "${PG_SERVICE}" -n 40 --no-pager >&2 || true
    if [[ -f "${PG_DATA}/log/postgresql-"*.log ]]; then
        printf '\n[setup-postgres] Log PostgreSQL:\n' >&2
        tail -40 "${PG_DATA}"/log/postgresql-*.log >&2 || true
    fi
    printf '\n[setup-postgres] Comandi utili:\n' >&2
    printf '  sudo -u postgres postgres -D %s --check-config\n' "$PG_DATA" >&2
    printf '  journalctl -u %s -n 50 --no-pager\n' "$PG_SERVICE" >&2
}

start_service() {
    if ! start_postgres; then
        show_startup_failure
        die "PostgreSQL non avviato. In container Proxmox prova: sudo ./start-postgres.sh"
    fi
    install_container_autostart "${SCRIPT_DIR}/start-postgres.sh"
}

configure_firewall() {
    if systemctl is-active --quiet firewalld; then
        log "Apro porta 5432/tcp su firewalld..."
        firewall-cmd --permanent --add-service=postgresql
        firewall-cmd --reload
    else
        log "firewalld non attivo, salto configurazione firewall"
    fi
}

setup_database() {
    log "Creo database, utente e schema..."
    sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
SELECT 'CREATE DATABASE ${DB_NAME}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
    ELSE
        ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
    END IF;
END
\$\$;
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF

    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCHEMA_FILE"

    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<EOF
GRANT INSERT, SELECT ON conteggi_pezzi TO ${DB_USER};
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO ${DB_USER};
EOF
}

show_summary() {
    local ip
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    cat <<EOF

Setup completato.

Database : ${DB_NAME}
Utente   : ${DB_USER}
Porta    : 5432
Accesso  : tutte le subnet (0.0.0.0/0, ::/0)
Servizio : ${PG_SERVICE}

Configura i Raspberry (.env):
  DB_HOST=${ip:-IP_DEL_SERVER}
  DB_PORT=5432
  DB_NAME=${DB_NAME}
  DB_USER=${DB_USER}
  DB_PASSWORD=<la password scelta>

Test locale:
  psql -U ${DB_USER} -d ${DB_NAME} -h localhost

Test da rete:
  psql -U ${DB_USER} -d ${DB_NAME} -h ${ip:-IP_DEL_SERVER}

Verifica servizio:
  systemctl status ${PG_SERVICE}

EOF
}

main() {
    require_root
    prompt_password
    install_packages
    init_database
    fix_filesystem
    configure_network
    configure_selinux
    validate_config
    start_service
    configure_firewall
    setup_database
    show_summary
}

main "$@"
