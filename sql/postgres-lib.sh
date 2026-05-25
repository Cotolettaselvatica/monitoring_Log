#!/usr/bin/env bash
# Funzioni condivise per PostgreSQL su Rocky / container Proxmox LXC

PG_SERVICE="${PG_SERVICE:-postgresql}"
PG_DATA="${PG_DATA:-}"
PG_HBA_MARKER="${PG_HBA_MARKER:-# Industria 5.0 - tutte le subnet}"
PG_DROPIN_NAME="${PG_DROPIN_NAME:-industria5.conf}"

pg_log() {
    if declare -F log >/dev/null 2>&1; then
        log "$@"
    else
        printf '[postgres] %s\n' "$@"
    fi
}

run_as_postgres() {
    if command -v runuser >/dev/null 2>&1; then
        runuser -u postgres -- "$@"
    else
        sudo -u postgres "$@"
    fi
}

is_container() {
    if [[ -f /run/systemd/container ]]; then
        return 0
    fi
    if command -v systemd-detect-virt >/dev/null 2>&1 && systemd-detect-virt -q -c 2>/dev/null; then
        return 0
    fi
    if grep -qa 'container=lxc' /proc/1/environ 2>/dev/null; then
        return 0
    fi
    return 1
}

systemd_usable() {
    if ! command -v systemctl >/dev/null 2>&1; then
        return 1
    fi
    if ! pidof systemd >/dev/null 2>&1 && [[ ! -d /run/systemd/system ]]; then
        return 1
    fi
    local state
    state="$(systemctl is-system-running 2>/dev/null || true)"
    case "$state" in
        running|degraded) return 0 ;;
        *) return 1 ;;
    esac
}

postgres_pg_ctl() {
    command -v pg_ctl 2>/dev/null || true
}

postgres_is_running() {
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null \
            || pg_isready -h localhost -p 5432 -q 2>/dev/null \
            || pg_isready -q 2>/dev/null; then
            return 0
        fi
    fi

    if [[ -n "$PG_DATA" && -f "${PG_DATA}/postmaster.pid" ]]; then
        local pid
        pid="$(head -1 "${PG_DATA}/postmaster.pid" 2>/dev/null || true)"
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi

    if systemctl is-active --quiet "${PG_SERVICE}" 2>/dev/null; then
        return 0
    fi

    local pg_ctl
    pg_ctl="$(postgres_pg_ctl)"
    if [[ -n "$pg_ctl" && -n "$PG_DATA" ]]; then
        run_as_postgres "$pg_ctl" status -D "$PG_DATA" >/dev/null 2>&1 && return 0
    fi

    return 1
}

postgres_status_details() {
    local pg_ctl
    pg_ctl="$(postgres_pg_ctl)"

    pg_log "PG_DATA=${PG_DATA:-non impostato}"
    if command -v pg_isready >/dev/null 2>&1; then
        pg_log "pg_isready: $(pg_isready -h 127.0.0.1 -p 5432 2>&1 || true)"
    fi
    if [[ -n "$PG_DATA" && -f "${PG_DATA}/postmaster.pid" ]]; then
        pg_log "postmaster.pid: $(head -1 "${PG_DATA}/postmaster.pid" 2>/dev/null || echo assente)"
    fi
    if systemctl is-active "${PG_SERVICE}" >/dev/null 2>&1; then
        pg_log "systemd ${PG_SERVICE}: $(systemctl is-active "${PG_SERVICE}" 2>&1 || true)"
    fi
    if [[ -n "$pg_ctl" && -n "$PG_DATA" ]]; then
        pg_log "pg_ctl status:"
        run_as_postgres "$pg_ctl" status -D "$PG_DATA" 2>&1 || true
    fi
}

stop_postgres() {
    if systemctl is-active --quiet "${PG_SERVICE}" 2>/dev/null; then
        pg_log "Fermo PostgreSQL via systemd..."
        systemctl stop "${PG_SERVICE}" 2>/dev/null || true
    fi

    local pg_ctl
    pg_ctl="$(postgres_pg_ctl)"
    if [[ -n "$pg_ctl" && -n "$PG_DATA" ]]; then
        if run_as_postgres "$pg_ctl" status -D "$PG_DATA" >/dev/null 2>&1 \
            || [[ -f "${PG_DATA}/postmaster.pid" ]]; then
            pg_log "Fermo PostgreSQL via pg_ctl..."
            run_as_postgres "$pg_ctl" stop -D "$PG_DATA" -w -t 20 -m fast 2>/dev/null || true
        fi
    fi

    ! postgres_is_running
}

detect_listen_addresses() {
    if [[ -n "${LISTEN_ADDRESSES:-}" ]]; then
        printf '%s' "$LISTEN_ADDRESSES"
        return
    fi
    if is_container; then
        local ip=""
        ip="$(hostname -I 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i != "127.0.0.1") { print $i; exit }}')"
        if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
            ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')"
        fi
        if [[ -n "$ip" ]]; then
            pg_log "Container LXC: uso IP ${ip} (bind su 0.0.0.0 non permesso)"
            printf '127.0.0.1,%s' "$ip"
            return
        fi
        pg_log "Container LXC: fallback su localhost"
        printf '127.0.0.1'
        return
    fi
    printf '*'
}

cleanup_main_postgresql_conf() {
    local pg_conf="${PG_DATA}/postgresql.conf"
    local tmp

    [[ -f "$pg_conf" ]] || return 0

    pg_log "Ripulisco listen_addresses/logging_collector dal postgresql.conf principale..."
    tmp="$(mktemp)"
    awk '
        /^[[:space:]]*listen_addresses[[:space:]]*=/ { next }
        /^[[:space:]]*logging_collector[[:space:]]*=/ { next }
        { print }
    ' "$pg_conf" >"$tmp"
    mv "$tmp" "$pg_conf"
    chown postgres:postgres "$pg_conf"
    chmod 600 "$pg_conf"
}

ensure_conf_d_included() {
    local pg_conf="${PG_DATA}/postgresql.conf"

    [[ -f "$pg_conf" ]] || return 0
    if grep -qE "^[[:space:]]*include_dir[[:space:]]*=[[:space:]]*'conf\.d'" "$pg_conf"; then
        return 0
    fi

    pg_log "Abilito include_dir conf.d in postgresql.conf..."
    printf "\ninclude_dir = 'conf.d'\n" >>"$pg_conf"
    chown postgres:postgres "$pg_conf"
    chmod 600 "$pg_conf"
}

write_postgres_dropin_conf() {
    local dropin_dir="${PG_DATA}/conf.d"
    local dropin_file="${dropin_dir}/${PG_DROPIN_NAME}"
    local listen_value

    listen_value="$(detect_listen_addresses)"
    mkdir -p "$dropin_dir"

    pg_log "Scrivo ${dropin_file} (listen_addresses=${listen_value})..."
    cat >"$dropin_file" <<EOF
# Generato da Industria 5.0 - non modificare postgresql.conf manualmente
listen_addresses = '${listen_value}'
logging_collector = off
EOF

    chown postgres:postgres "$dropin_file"
    chmod 600 "$dropin_file"
}

set_listen_addresses() {
    cleanup_main_postgresql_conf
    ensure_conf_d_included
    write_postgres_dropin_conf
}

fix_logging_collector() {
    mkdir -p "${PG_DATA}/log" "${PG_DATA}/conf.d"
    chown postgres:postgres "${PG_DATA}/log" "${PG_DATA}/conf.d"
    chmod 700 "${PG_DATA}/log"
    # logging_collector gestito in conf.d/industria5.conf
}

write_pg_hba_file() {
    local hba_conf="${PG_DATA}/pg_hba.conf"
    local auth_method="scram-sha-256"

    pg_log "Scrivo pg_hba.conf pulito (tutte le subnet IPv4)..."
    cat >"$hba_conf" <<EOF
# PostgreSQL Client Authentication Configuration File
local   all             all                                     peer
host    all             all             127.0.0.1/32            ${auth_method}
host    all             all             ::1/128                 ${auth_method}
${PG_HBA_MARKER}
host    all             all             0.0.0.0/0               ${auth_method}
EOF

    chown postgres:postgres "$hba_conf"
    chmod 600 "$hba_conf"
}

postgres_supports_check_config() {
    local postgres_bin
    postgres_bin="$(command -v postgres 2>/dev/null || true)"
    [[ -n "$postgres_bin" ]] && run_as_postgres "$postgres_bin" --help 2>&1 | grep -q -- '--check-config'
}

validate_postgres_config() {
    local postgres_bin err_file
    postgres_bin="$(command -v postgres 2>/dev/null || true)"
    [[ -n "$postgres_bin" ]] || return 0

    if ! postgres_supports_check_config; then
        pg_log "Opzione --check-config non supportata, salto verifica"
        return 0
    fi

    err_file="$(mktemp)"
    pg_log "Verifico configurazione PostgreSQL..."
    if run_as_postgres "$postgres_bin" -D "$PG_DATA" --check-config >"$err_file" 2>&1; then
        rm -f "$err_file"
        return 0
    fi

    pg_log "Prima verifica fallita:"
    cat "$err_file" >&2

    if grep -qi 'log\|logging_collector\|listen_addresses' "$err_file"; then
        set_listen_addresses
    fi
    if grep -qi 'pg_hba.conf' "$err_file"; then
        write_pg_hba_file
    fi

    pg_log "Seconda verifica configurazione..."
    if run_as_postgres "$postgres_bin" -D "$PG_DATA" --check-config; then
        rm -f "$err_file"
        return 0
    fi

    rm -f "$err_file"
    pg_log "Verifica config fallita: provo avvio PostgreSQL comunque..."
    return 0
}

start_postgres_pg_ctl() {
    local pg_ctl log_file
    pg_ctl="$(postgres_pg_ctl)"
    [[ -n "$pg_ctl" ]] || return 1

    log_file="${PG_DATA}/log/postgresql.log"
    mkdir -p "${PG_DATA}/log"
    chown postgres:postgres "${PG_DATA}/log"

    if postgres_is_running; then
        pg_log "PostgreSQL gia' in esecuzione (pg_ctl)"
        return 0
    fi

    pg_log "Avvio PostgreSQL con pg_ctl (modalita' container)..."
    if ! run_as_postgres "$pg_ctl" start -D "$PG_DATA" -w -t 30 -l "$log_file"; then
        if grep -qi 'could not bind' "$log_file" 2>/dev/null; then
            pg_log "Bind IPv4 fallito: riconfiguro listen_addresses con IP container..."
            set_listen_addresses
            if run_as_postgres "$pg_ctl" start -D "$PG_DATA" -w -t 30 -l "$log_file"; then
                return 0
            fi
        fi
        pg_log "pg_ctl fallito. Log:"
        tail -40 "$log_file" 2>/dev/null || true
        return 1
    fi
    return 0
}

start_postgres_systemd() {
    pg_log "Avvio PostgreSQL con systemd (${PG_SERVICE})..."
    systemctl enable "${PG_SERVICE}" 2>/dev/null || true
    systemctl reset-failed "${PG_SERVICE}" 2>/dev/null || true
    systemctl restart "${PG_SERVICE}"
    sleep 2
    systemctl is-active --quiet "${PG_SERVICE}"
}

start_postgres() {
    if is_container; then
        pg_log "Ambiente container Proxmox/LXC rilevato"
    fi

    if systemd_usable; then
        if start_postgres_systemd; then
            pg_log "PostgreSQL attivo (systemd)"
            return 0
        fi
        pg_log "systemd fallito, provo pg_ctl..."
    else
        pg_log "systemd non disponibile nel container, uso pg_ctl"
    fi

    start_postgres_pg_ctl || return 1
    pg_log "PostgreSQL attivo (pg_ctl)"
    return 0
}

install_container_autostart() {
    local script_path="$1"
    local rc_local="/etc/rc.d/rc.local"

    [[ -f "$script_path" ]] || return 0
    if ! is_container || systemd_usable; then
        return 0
    fi

    pg_log "Configuro avvio automatico container (rc.local)..."
    chmod +x "$script_path"
    touch "$rc_local"
    chmod +x "$rc_local"
    if ! grep -qF "$script_path" "$rc_local" 2>/dev/null; then
        cat >>"$rc_local" <<EOF

# PostgreSQL Industria 5.0
sleep 3
${script_path} start
EOF
    fi
}
