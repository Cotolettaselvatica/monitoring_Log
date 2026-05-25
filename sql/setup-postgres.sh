#!/usr/bin/env bash
# Installa e configura PostgreSQL su Rocky Linux (container LXC incluso).
# Uso: sudo ./setup-postgres.sh
set -euo pipefail

DB_HOST_IP="172.20.1.84"
DB_NAME="raspberry_counter"
DB_USER="counter"
DB_PASSWORD='Catis_Pg_2026!'
PG_DATA="/var/lib/pgsql/data"
SCHEMA_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/schema.sql"

log() { printf '[setup-postgres] %s\n' "$*"; }
die() { printf '[setup-postgres] ERRORE: %s\n' "$*" >&2; exit 1; }

sql_quote() {
    printf "%s" "$1" | sed "s/'/''/g"
}

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Esegui con sudo"
[[ -f "$SCHEMA_FILE" ]] || die "File schema non trovato: ${SCHEMA_FILE}"

install_postgres() {
    if command -v postgres >/dev/null 2>&1; then
        log "PostgreSQL gia' installato"
        return
    fi
    log "Installo postgresql-server..."
    dnf install -y postgresql-server postgresql-contrib
}

init_cluster() {
    if [[ -f "${PG_DATA}/postgresql.conf" ]]; then
        log "Cluster gia' inizializzato in ${PG_DATA}"
        return
    fi
    log "Inizializzo cluster PostgreSQL..."
    postgresql-setup --initdb
}

configure_network() {
    local pg_conf="${PG_DATA}/postgresql.conf"
    local pg_hba="${PG_DATA}/pg_hba.conf"
    local listen="127.0.0.1,${DB_HOST_IP}"

    log "Configuro ascolto su ${listen}..."

    if grep -q "# Industria 5.0" "$pg_conf"; then
        sed -i '/# Industria 5.0/,/^logging_collector = off$/d' "$pg_conf"
    fi
    sed -i '/listen_addresses/d' "$pg_conf"

    {
        printf '\n# Industria 5.0\n'
        printf "listen_addresses = '%s'\n" "$listen"
        printf '%s\n' "logging_collector = off"
    } >>"$pg_conf"

    chown postgres:postgres "$pg_conf"
    chmod 600 "$pg_conf"

    log "Scrivo pg_hba.conf..."
    cat >"$pg_hba" <<'EOF'
# PostgreSQL Client Authentication - Industria 5.0
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
EOF
    chown postgres:postgres "$pg_hba"
    chmod 600 "$pg_hba"
}

configure_firewall() {
    if systemctl is-active --quiet firewalld 2>/dev/null; then
        log "Apro porta PostgreSQL su firewalld..."
        firewall-cmd --permanent --add-service=postgresql
        firewall-cmd --reload
    fi

    if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" != "Disabled" ]]; then
        setsebool -P postgresql_can_network_connect on 2>/dev/null || true
    fi
}

start_postgres() {
    log "Avvio PostgreSQL..."
    systemctl enable postgresql
    systemctl restart postgresql
}

setup_database() {
    local quoted_pwd
    quoted_pwd="$(sql_quote "$DB_PASSWORD")"

    log "Creo database ${DB_NAME} e utente ${DB_USER}..."

    sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOSQL
SELECT 'CREATE DATABASE ${DB_NAME}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
EOSQL

    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1; then
        sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
            "ALTER USER ${DB_USER} WITH PASSWORD '${quoted_pwd}';"
    else
        sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
            "CREATE USER ${DB_USER} WITH PASSWORD '${quoted_pwd}';"
    fi

    sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
        "GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};"

    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCHEMA_FILE"

    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<EOSQL
GRANT INSERT, SELECT ON conteggi_pezzi TO ${DB_USER};
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO ${DB_USER};
EOSQL
}

verify_login() {
    log "Verifico login utente ${DB_USER}..."
    if PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1;' >/dev/null 2>&1; then
        log "Login OK"
        return 0
    fi
    die "Login fallito per ${DB_USER}. Controlla password e pg_hba.conf"
}

show_summary() {
    cat <<EOF

Setup completato.

Host     : ${DB_HOST_IP}
Porta    : 5432
Database : ${DB_NAME}
Utente   : ${DB_USER}
Config   : ${PG_DATA}/postgresql.conf

Test locale:
  psql -U ${DB_USER} -d ${DB_NAME} -h 127.0.0.1 -W

Test da rete:
  psql -U ${DB_USER} -d ${DB_NAME} -h ${DB_HOST_IP} -W
EOF
}

install_postgres
init_cluster
configure_network
configure_firewall
start_postgres
setup_database
verify_login
show_summary
