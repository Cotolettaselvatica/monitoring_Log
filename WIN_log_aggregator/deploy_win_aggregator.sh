#!/usr/bin/env bash
# Deploy WIN_log_aggregator su Rocky Linux
# Uso: sudo ./deploy_win_aggregator.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/win-log-aggregator"
ENV_FILE="/etc/win-log-aggregator.env"
SERVICE_NAME="win-log-aggregator.service"
SERVICE_USER="${SERVICE_USER:-logagg}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERRORE: %s\n' "$*" >&2; exit 1; }

require_root() {
    [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Esegui con sudo: sudo ./deploy_win_aggregator.sh"
}

ensure_service_user() {
    mkdir -p "$INSTALL_DIR"
    if ! id "$SERVICE_USER" >/dev/null 2>&1; then
        log "Creo utente ${SERVICE_USER}..."
        useradd --system --home-dir "$INSTALL_DIR" --shell /sbin/nologin "$SERVICE_USER"
    fi
}

install_packages() {
    log "Installo pacchetti di sistema..."
    dnf install -y python3 python3-pip unixODBC unixODBC-devel
    if [[ ! -f /etc/yum.repos.d/mssql-release.repo ]]; then
        curl -fsSL https://packages.microsoft.com/config/rhel/9/prod.repo -o /etc/yum.repos.d/mssql-release.repo
    fi
    ACCEPT_EULA=Y dnf install -y msodbcsql18 || log "msodbcsql18 non installato (serve per source_type mssql)"
}

install_start_script() {
    local start_script="${INSTALL_DIR}/start-aggregator.sh"

    cat >"$start_script" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd ${INSTALL_DIR}
export AGGREGATOR_ENV=${ENV_FILE}
export AGGREGATOR_BASE_DIR=${INSTALL_DIR}
exec ${INSTALL_DIR}/.venv/bin/python -m aggregator.main
EOF
    chmod 755 "$start_script"
    chown root:root "$start_script"
}

install_application() {
    log "Installo applicazione in ${INSTALL_DIR}..."

    mkdir -p "${INSTALL_DIR}/config" "${INSTALL_DIR}/state"
    cp -r "${SCRIPT_DIR}/aggregator" "${INSTALL_DIR}/"
    cp "${SCRIPT_DIR}/requirements.txt" "${INSTALL_DIR}/"

    if [[ ! -f "${INSTALL_DIR}/config/machines.yaml" ]]; then
        cp "${SCRIPT_DIR}/config/machines.example.yaml" "${INSTALL_DIR}/config/machines.yaml"
        log "Creato ${INSTALL_DIR}/config/machines.yaml (da configurare)"
    fi

    if [[ ! -d "${INSTALL_DIR}/.venv" ]]; then
        log "Creo virtualenv Python..."
        python3 -m venv "${INSTALL_DIR}/.venv"
    fi

    "${INSTALL_DIR}/.venv/bin/pip" install --upgrade pip
    "${INSTALL_DIR}/.venv/bin/pip" install -r "${INSTALL_DIR}/requirements.txt"

    install_start_script
    chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
    chown root:root "${INSTALL_DIR}/start-aggregator.sh"
}

write_env_file() {
    if [[ -f "$ENV_FILE" ]]; then
        log "Config esistente: ${ENV_FILE} (non sovrascritto)"
        return
    fi

    log "Scrivo ${ENV_FILE} da .env.example..."
    cat >"$ENV_FILE" <<EOF
# Generato da deploy_win_aggregator.sh il $(date -Iseconds)
DB_HOST=172.20.1.84
DB_PORT=5432
DB_NAME=raspberry_counter
DB_USER=counter
DB_PASSWORD=CatisPg2026

AGGREGATOR_BASE_DIR=${INSTALL_DIR}
MACHINES_CONFIG=${INSTALL_DIR}/config/machines.yaml
STATE_FILE=${INSTALL_DIR}/state/offsets.json
POLL_INTERVAL_SEC=30
EOF
    chmod 600 "$ENV_FILE"
    chown "${SERVICE_USER}:${SERVICE_USER}" "$ENV_FILE"
}

systemd_usable() {
    if ! command -v systemctl >/dev/null 2>&1; then
        return 1
    fi
    if ! pidof systemd >/dev/null 2>&1 && [[ ! -d /run/systemd/system ]]; then
        return 1
    fi
    systemctl list-unit-files --type=service --no-legend >/dev/null 2>&1
}

start_aggregator_now() {
    log "Avvio aggregator..."
    if pgrep -f "${INSTALL_DIR}/.venv/bin/python -m aggregator.main" >/dev/null 2>&1; then
        log "Aggregator gia' in esecuzione"
        return 0
    fi
    sudo -u "$SERVICE_USER" -H nohup "$INSTALL_DIR/start-aggregator.sh" \
        >>"${INSTALL_DIR}/aggregator.log" 2>&1 &
    sleep 2
    pgrep -f "${INSTALL_DIR}/.venv/bin/python -m aggregator.main" >/dev/null 2>&1 \
        || die "Aggregator non avviato. Vedi ${INSTALL_DIR}/aggregator.log"
    log "Aggregator avviato (nohup)"
}

install_cron_autostart() {
    local cron_file="/etc/cron.d/win-log-aggregator"

    log "Configuro avvio automatico al boot via cron..."
    cat >"$cron_file" <<EOF
SHELL=/bin/bash
PATH=/sbin:/bin:/usr/sbin:/usr/bin
@reboot root sleep 15 && su -s /bin/bash ${SERVICE_USER} -c '${INSTALL_DIR}/start-aggregator.sh >> ${INSTALL_DIR}/aggregator.log 2>&1 &'
EOF
    chmod 644 "$cron_file"
    log "Avvio automatico al boot: abilitato (cron @reboot)"
}

install_systemd_service() {
    local service_path="/etc/systemd/system/${SERVICE_NAME}"

    if ! systemd_usable; then
        log "systemd non disponibile (tipico container LXC)"
        install_cron_autostart
        start_aggregator_now
        return
    fi

    log "Installo servizio systemd ${SERVICE_NAME}..."
    cat >"$service_path" <<EOF
[Unit]
Description=Aggregatore log macchine Windows via SMB -> PostgreSQL
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${ENV_FILE}
Environment=AGGREGATOR_ENV=${ENV_FILE}
ExecStart=${INSTALL_DIR}/start-aggregator.sh
Restart=always
RestartSec=10
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
EOF

    chmod 644 "$service_path"
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"

    if ! systemctl is-enabled --quiet "$SERVICE_NAME"; then
        die "Avvio automatico al boot non abilitato per ${SERVICE_NAME}"
    fi
    log "Avvio automatico al boot: abilitato (systemd)"

    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "Servizio ${SERVICE_NAME} attivo"
        return
    fi

    log "systemd non ha avviato il servizio, uso fallback cron..."
    install_cron_autostart
    start_aggregator_now
}

show_summary() {
    cat <<EOF

Deploy completato.

Directory  : ${INSTALL_DIR}
Config DB  : ${ENV_FILE}
Macchine   : ${INSTALL_DIR}/config/machines.yaml
Servizio   : ${SERVICE_NAME}
Avvio boot : systemd (o cron @reboot su container LXC)

Comandi:
  sudo systemctl status ${SERVICE_NAME}
  sudo systemctl is-enabled ${SERVICE_NAME}
  journalctl -u ${SERVICE_NAME} -f
  sudo nano ${ENV_FILE}
  sudo nano ${INSTALL_DIR}/config/machines.yaml

Schema DB (se non ancora eseguito):
  sudo -u postgres psql -d raspberry_counter -f ${SCRIPT_DIR}/sql/schema.sql
EOF
}

require_root
ensure_service_user
install_packages
install_application
write_env_file
install_systemd_service
show_summary
