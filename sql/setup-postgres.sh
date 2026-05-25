#!/usr/bin/env bash
# Installa e configura PostgreSQL su Rocky Linux (container LXC incluso).
# Uso: sudo ./setup-postgres.sh
set -euo pipefail

DB_HOST_IP="172.20.1.84"
DB_NAME="raspberry_counter"
DB_USER="counter"
DB_PASSWORD='C4t1$dbPost_2026!'
PG_DATA="/var/lib/pgsql/data"
SCHEMA_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/schema.sql"

log() { printf '[setup-postgres] %s\n' "$*"; }
die() { printf '[setup-postgres] ERRORE: %s\n' "$*" >&2; exit 1; }

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

    if ! grep -q "Industria 5.0 - accesso rete" "$pg_hba"; then
        cat >>"$pg_hba" <<'EOF'

# Industria 5.0 - accesso rete
host    all    all    0.0.0.0/0    scram-sha-256
host    all    all    ::/0         scram-sha-256
EOF
        chown postgres:postgres "$pg_hba"
        chmod 600 "$pg_hba"
    fi
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
    log "Creo database ${DB_NAME} e utente ${DB_USER}..."

    sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOSQL
SELECT 'CREATE DATABASE ${DB_NAME}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE USER ${DB_USER} WITH PASSWORD \$pwd\$${DB_PASSWORD}\$pwd\$;
    ELSE
        ALTER USER ${DB_USER} WITH PASSWORD \$pwd\$${DB_PASSWORD}\$pwd\$;
    END IF;
END
\$\$;

GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL

    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCHEMA_FILE"

    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<EOSQL
GRANT INSERT, SELECT ON conteggi_pezzi TO ${DB_USER};
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO ${DB_USER};
EOSQL
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
show_summary
