#!/usr/bin/env bash
# Installa e configura PostgreSQL su Rocky Linux (container LXC incluso).
# Uso: sudo ./setup-postgres.sh
set -euo pipefail
set +H

DB_HOST_IP="172.20.1.84"
DB_NAME="raspberry_counter"
DB_USER="counter"
DB_PASSWORD='CatisPg2026'
PG_DATA="/var/lib/pgsql/data"
SCHEMA_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/schema.sql"

log() { printf '[setup-postgres] %s\n' "$*"; }
die() { printf '[setup-postgres] ERRORE: %s\n' "$*" >&2; exit 1; }

sql_quote() {
    printf "%s" "$1" | sed "s/'/''/g"
}

run_as_postgres() {
    if command -v runuser >/dev/null 2>&1; then
        runuser -u postgres -- "$@"
    else
        sudo -u postgres "$@"
    fi
}

pg_ctl_bin() {
    command -v pg_ctl 2>/dev/null || true
}

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Esegui con sudo"
[[ -f "$SCHEMA_FILE" ]] || die "File schema non trovato: ${SCHEMA_FILE}"

install_postgres() {
    if command -v postgres >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
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
    sed -i '/password_encryption/d' "$pg_conf"

    {
        printf '\n# Industria 5.0\n'
        printf "listen_addresses = '%s'\n" "$listen"
        printf '%s\n' "password_encryption = scram-sha-256"
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

    mkdir -p "${PG_DATA}/log"
    chown postgres:postgres "${PG_DATA}/log"
    chmod 700 "${PG_DATA}/log"
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

postgres_is_running() {
    if command -v pg_isready >/dev/null 2>&1; then
        pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && return 0
    fi
    [[ -f "${PG_DATA}/postmaster.pid" ]] && ps -p "$(head -1 "${PG_DATA}/postmaster.pid")" >/dev/null 2>&1
}

wait_for_postgres() {
    local i
    for i in $(seq 1 30); do
        if postgres_is_running; then
            return 0
        fi
        sleep 1
    done
    return 1
}

start_postgres_pg_ctl() {
    local pg_ctl log_file
    pg_ctl="$(pg_ctl_bin)"
    [[ -n "$pg_ctl" ]] || return 1
    log_file="${PG_DATA}/log/postgresql.log"

    if postgres_is_running; then
        log "Riavvio PostgreSQL con pg_ctl..."
        run_as_postgres "$pg_ctl" restart -D "$PG_DATA" -w -t 30 -l "$log_file"
    else
        log "Avvio PostgreSQL con pg_ctl..."
        run_as_postgres "$pg_ctl" start -D "$PG_DATA" -w -t 30 -l "$log_file"
    fi
}

start_postgres() {
    log "Avvio PostgreSQL..."
    if systemctl is-active --quiet postgresql 2>/dev/null \
        || systemctl list-unit-files postgresql.service --no-legend 2>/dev/null | grep -q postgresql; then
        systemctl enable postgresql 2>/dev/null || true
        if systemctl restart postgresql 2>/dev/null && wait_for_postgres; then
            log "PostgreSQL attivo (systemd)"
            return 0
        fi
        log "systemd non ha avviato PostgreSQL, provo pg_ctl..."
    fi

    start_postgres_pg_ctl || die "Impossibile avviare PostgreSQL. Vedi ${PG_DATA}/log/postgresql.log"
    wait_for_postgres || die "PostgreSQL non risponde dopo l'avvio"
    log "PostgreSQL attivo (pg_ctl)"
}

reload_postgres() {
    local pg_ctl
    pg_ctl="$(pg_ctl_bin)"
    if [[ -n "$pg_ctl" ]] && postgres_is_running; then
        run_as_postgres "$pg_ctl" reload -D "$PG_DATA" || true
    elif systemctl is-active --quiet postgresql 2>/dev/null; then
        systemctl reload postgresql 2>/dev/null || systemctl restart postgresql 2>/dev/null || true
    fi
    wait_for_postgres || die "PostgreSQL non risponde dopo reload"
}

set_user_password() {
    local quoted_pwd sql_file
    quoted_pwd="$(sql_quote "$DB_PASSWORD")"
    sql_file="$(mktemp /tmp/pg-setpwd.XXXXXX.sql)"
    chmod 600 "$sql_file"
    chown postgres:postgres "$sql_file"

    if run_as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -qx 1; then
        {
            printf '%s\n' "SET password_encryption = 'scram-sha-256';"
            printf "ALTER ROLE %s WITH LOGIN PASSWORD '%s';\n" "$DB_USER" "$quoted_pwd"
        } >"$sql_file"
    else
        {
            printf '%s\n' "SET password_encryption = 'scram-sha-256';"
            printf "CREATE ROLE %s WITH LOGIN PASSWORD '%s';\n" "$DB_USER" "$quoted_pwd"
        } >"$sql_file"
    fi

    run_as_postgres psql -v ON_ERROR_STOP=1 -f "$sql_file"
    rm -f "$sql_file"
}

setup_database() {
    log "Creo database ${DB_NAME} e utente ${DB_USER}..."

    run_as_postgres psql -v ON_ERROR_STOP=1 <<EOSQL
SELECT 'CREATE DATABASE ${DB_NAME}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
EOSQL

    set_user_password

    run_as_postgres psql -v ON_ERROR_STOP=1 -c \
        "GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};"

    run_as_postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCHEMA_FILE"

    run_as_postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<EOSQL
GRANT USAGE ON SCHEMA public TO ${DB_USER};
GRANT INSERT, SELECT ON conteggi_pezzi TO ${DB_USER};
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO ${DB_USER};
EOSQL

    reload_postgres
}

verify_login() {
    local err
    log "Verifico login utente ${DB_USER}..."

    if ! run_as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}' AND rolpassword IS NOT NULL" | grep -qx 1; then
        die "Utente ${DB_USER} senza password impostata"
    fi

    local hash_type
    hash_type="$(run_as_postgres psql -tAc "SELECT CASE WHEN rolpassword LIKE 'SCRAM-SHA-256%' THEN 'scram' WHEN rolpassword LIKE 'md5%' THEN 'md5' ELSE 'other' END FROM pg_authid WHERE rolname = '${DB_USER}'")"
    log "Tipo hash password: ${hash_type:-sconosciuto}"
    if [[ "$hash_type" == "md5" ]]; then
        log "Hash md5 rilevato con pg_hba scram: reimposto password..."
        set_user_password
    fi

    err="$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1;' 2>&1)" \
        && { log "Login OK (127.0.0.1)"; return 0; }

    log "Dettaglio errore login:"
    printf '%s\n' "$err" >&2
    die "Login fallito per ${DB_USER}. Controlla password e pg_hba.conf"
}

show_summary() {
    cat <<EOF

Setup completato.

Host     : ${DB_HOST_IP}
Porta    : 5432
Database : ${DB_NAME}
Utente   : ${DB_USER}
Password : ${DB_PASSWORD}
Config   : ${PG_DATA}/postgresql.conf

Test locale:
  PGPASSWORD='${DB_PASSWORD}' psql -U ${DB_USER} -d ${DB_NAME} -h 127.0.0.1 -c 'SELECT 1;'

Test da rete:
  PGPASSWORD='${DB_PASSWORD}' psql -U ${DB_USER} -d ${DB_NAME} -h ${DB_HOST_IP} -c 'SELECT 1;'
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
