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
    dnf install -y python3 python3-pip
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

    chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
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

install_systemd_service() {
    local service_path="/etc/systemd/system/${SERVICE_NAME}"

    log "Creo servizio systemd ${SERVICE_NAME}..."
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
ExecStart=${INSTALL_DIR}/.venv/bin/python -m aggregator.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    chmod 644 "$service_path"
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"

    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "Servizio ${SERVICE_NAME} attivo"
    else
        systemctl status "$SERVICE_NAME" --no-pager -l || true
        die "Servizio non avviato. Controlla: journalctl -u ${SERVICE_NAME} -n 50"
    fi
}

show_summary() {
    cat <<EOF

Deploy completato.

Directory  : ${INSTALL_DIR}
Config DB  : ${ENV_FILE}
Macchine   : ${INSTALL_DIR}/config/machines.yaml
Servizio   : ${SERVICE_NAME}

Comandi:
  sudo systemctl status ${SERVICE_NAME}
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
