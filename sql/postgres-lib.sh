#!/usr/bin/env bash
# Funzioni condivise per PostgreSQL su Rocky / container Proxmox LXC

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
    local pg_ctl
    pg_ctl="$(postgres_pg_ctl)"
    [[ -n "$pg_ctl" ]] && sudo -u postgres "$pg_ctl" status -D "$PG_DATA" >/dev/null 2>&1
}

start_postgres_pg_ctl() {
    local pg_ctl log_file
    pg_ctl="$(postgres_pg_ctl)"
    [[ -n "$pg_ctl" ]] || return 1

    log_file="${PG_DATA}/log/postgresql.log"
    mkdir -p "${PG_DATA}/log"
    chown postgres:postgres "${PG_DATA}/log"

    if postgres_is_running; then
        log "PostgreSQL gia' in esecuzione (pg_ctl)"
        return 0
    fi

    log "Avvio PostgreSQL con pg_ctl (modalita' container)..."
    if ! sudo -u postgres "$pg_ctl" start -D "$PG_DATA" -w -t 30 -l "$log_file"; then
        log "pg_ctl fallito. Log:"
        tail -40 "$log_file" 2>/dev/null || true
        return 1
    fi
    return 0
}

start_postgres_systemd() {
    log "Avvio PostgreSQL con systemd (${PG_SERVICE})..."
    systemctl enable "${PG_SERVICE}" 2>/dev/null || true
    systemctl reset-failed "${PG_SERVICE}" 2>/dev/null || true
    systemctl restart "${PG_SERVICE}"
    sleep 2
    systemctl is-active --quiet "${PG_SERVICE}"
}

start_postgres() {
    if is_container; then
        log "Ambiente container Proxmox/LXC rilevato"
    fi

    if systemd_usable; then
        if start_postgres_systemd; then
            log "PostgreSQL attivo (systemd)"
            return 0
        fi
        log "systemd fallito, provo pg_ctl..."
    else
        log "systemd non disponibile nel container, uso pg_ctl"
    fi

    start_postgres_pg_ctl || return 1
    log "PostgreSQL attivo (pg_ctl)"
    return 0
}

install_container_autostart() {
    local script_path="$1"
    local rc_local="/etc/rc.d/rc.local"

    [[ -f "$script_path" ]] || return 0
    if ! is_container || systemd_usable; then
        return 0
    fi

    log "Configuro avvio automatico container (rc.local)..."
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
