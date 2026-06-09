#!/usr/bin/env bash
# Deploy Log_dashboard (backend FastAPI + frontend statico + nginx) su Rocky Linux
# Uso: sudo ./deploy_log_dashboard.sh [opzioni]
#
# Opzioni:
#   --public-host HOST   Host/IP dashboard in produzione (default: 172.20.1.87)
#   --db-host HOST       PostgreSQL (default: 172.20.1.84)
#   --db-port PORT       (default: 5432)
#   --db-name NAME       (default: raspberry_counter)
#   --db-user USER       (default: counter)
#   --db-password PASS   (default: CatisPg2026)
#   --api-port PORT      (default: 8000)
#   --skip-db-schema     Non esegue setup-dashboard.sh
#   --skip-frontend      Non builda il frontend (usa dist/ esistente)
#   --skip-nginx         Non configura nginx
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/log-dashboard"
ENV_FILE="/etc/log-dashboard.env"
SERVICE_NAME="log-dashboard-api.service"
NGINX_CONF="/etc/nginx/conf.d/log-dashboard.conf"
SERVICE_USER="${SERVICE_USER:-logdash}"

PUBLIC_HOST="172.20.1.87"
DB_HOST="172.20.1.84"
DB_PORT="5432"
DB_NAME="raspberry_counter"
DB_USER="counter"
DB_PASSWORD="CatisPg2026"
API_PORT="8000"
SKIP_DB_SCHEMA=0
SKIP_FRONTEND=0
SKIP_NGINX=0

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERRORE: %s\n' "$*" >&2; exit 1; }

usage() {
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --public-host) PUBLIC_HOST="${2:-}"; shift 2 ;;
            --db-host) DB_HOST="${2:-}"; shift 2 ;;
            --db-port) DB_PORT="${2:-}"; shift 2 ;;
            --db-name) DB_NAME="${2:-}"; shift 2 ;;
            --db-user) DB_USER="${2:-}"; shift 2 ;;
            --db-password) DB_PASSWORD="${2:-}"; shift 2 ;;
            --api-port) API_PORT="${2:-}"; shift 2 ;;
            --skip-db-schema) SKIP_DB_SCHEMA=1; shift ;;
            --skip-frontend) SKIP_FRONTEND=1; shift ;;
            --skip-nginx) SKIP_NGINX=1; shift ;;
            -h|--help) usage ;;
            *) die "Opzione sconosciuta: $1 (usa --help)" ;;
        esac
    done
}

require_root() {
    [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Esegui con sudo: sudo ./deploy_log_dashboard.sh"
}

log_public_host() {
    log "Host dashboard (frontend/API): ${PUBLIC_HOST}"
    log "Host PostgreSQL: ${DB_HOST}"
}

ensure_service_user() {
    mkdir -p "$INSTALL_DIR"
    if ! id "$SERVICE_USER" >/dev/null 2>&1; then
        log "Creo utente ${SERVICE_USER}..."
        useradd --system --home-dir "$INSTALL_DIR" --shell /sbin/nologin "$SERVICE_USER"
    fi
}

node_major_version() {
    node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1
}

remove_distro_nodejs() {
    local pkgs=()
    rpm -q nodejs >/dev/null 2>&1 && pkgs+=(nodejs)
    rpm -q npm >/dev/null 2>&1 && pkgs+=(npm)
    rpm -q nodejs-full-i18n >/dev/null 2>&1 && pkgs+=(nodejs-full-i18n)
    if [[ ${#pkgs[@]} -eq 0 ]]; then
        return
    fi
    log "Rimuovo Node.js distro (conflitto con NodeSource): ${pkgs[*]}"
    dnf remove -y "${pkgs[@]}" || true
}

install_nodejs_20() {
    log "Installo Node.js 20 LTS (Vite 5 richiede >= 18)..."
    if command -v dnf >/dev/null 2>&1; then
        dnf install -y curl ca-certificates
        remove_distro_nodejs
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        # --allowerasing: sostituisce nodejs 16 appstream; esclude repo nsolid (non serve)
        dnf install -y --allowerasing --disablerepo=nodesource-nsolid nodejs
        return
    fi
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y curl ca-certificates
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        return
    fi
    die "Node.js >= 18 richiesto. Installa manualmente Node 20 o usa --skip-frontend con dist/ precompilato"
}

ensure_nodejs() {
    if [[ "$SKIP_FRONTEND" -eq 1 ]]; then
        return
    fi

    local major=0
    if command -v node >/dev/null 2>&1; then
        major="$(node_major_version)"
    fi

    if [[ "$major" -ge 18 ]]; then
        log "Node.js $(node -v) OK (richiesto >= 18)"
        return
    fi

    log "Node.js insufficiente per Vite 5 (attuale: $(node -v 2>/dev/null || echo assente))"
    install_nodejs_20

    major="$(node_major_version)"
    [[ "$major" -ge 18 ]] || die "Node.js ancora insufficiente: $(node -v 2>/dev/null || echo assente)"
    log "Node.js $(node -v) pronto"
}

install_packages() {
    log "Installo pacchetti di sistema..."
    if command -v dnf >/dev/null 2>&1; then
        dnf install -y python3 python3-pip nginx curl ca-certificates
        return
    fi
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y python3 python3-pip python3-venv nginx curl ca-certificates
        return
    fi
    die "Gestore pacchetti non supportato (serve dnf o apt)"
}

install_backend() {
    local backend_src="${SCRIPT_DIR}/backend"
    local backend_dst="${INSTALL_DIR}/backend"

    [[ -d "${backend_src}/app" ]] || die "Backend non trovato in ${backend_src}"

    log "Installo backend in ${backend_dst}..."
    mkdir -p "${backend_dst}/uploads"
    rm -rf "${backend_dst}/app" "${backend_dst}/sql"
    cp -r "${backend_src}/app" "${backend_dst}/"
    cp -r "${backend_src}/sql" "${backend_dst}/"
    cp "${backend_src}/requirements.txt" "${backend_dst}/"

    if [[ ! -d "${backend_dst}/.venv" ]]; then
        log "Creo virtualenv Python..."
        python3 -m venv "${backend_dst}/.venv"
    fi

    "${backend_dst}/.venv/bin/pip" install --upgrade pip -q
    "${backend_dst}/.venv/bin/pip" install -r "${backend_dst}/requirements.txt" -q

    cat >"${backend_dst}/start-api.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd ${backend_dst}
set -a
source ${ENV_FILE}
set +a
export PYTHONPATH=${backend_dst}
exec ${backend_dst}/.venv/bin/uvicorn app.main:app --host "\${API_HOST:-0.0.0.0}" --port "\${API_PORT:-8000}"
EOF
    chmod 755 "${backend_dst}/start-api.sh"
    chown -R "${SERVICE_USER}:${SERVICE_USER}" "${backend_dst}"
    chown root:root "${backend_dst}/start-api.sh"
}

write_env_file() {
    local api_base="http://${PUBLIC_HOST}:${API_PORT}"
    local web_base="http://${PUBLIC_HOST}"

    if [[ -f "$ENV_FILE" ]]; then
        log "Config esistente: ${ENV_FILE} (non sovrascritto)"
        return
    fi

    log "Scrivo ${ENV_FILE}..."
    cat >"$ENV_FILE" <<EOF
# Generato da deploy_log_dashboard.sh il $(date -Iseconds 2>/dev/null || date)
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

API_HOST=0.0.0.0
API_PORT=${API_PORT}
CORS_ORIGINS=${web_base},http://127.0.0.1,http://localhost

UPLOAD_DIR=${INSTALL_DIR}/backend/uploads
PUBLIC_BASE_URL=${api_base}
EOF
    chmod 600 "$ENV_FILE"
    chown "${SERVICE_USER}:${SERVICE_USER}" "$ENV_FILE"
}

apply_db_schema() {
    if [[ "$SKIP_DB_SCHEMA" -eq 1 ]]; then
        log "Salto setup schema DB (--skip-db-schema)"
        return
    fi

    local setup_script="${SCRIPT_DIR}/backend/sql/setup-dashboard.sh"
    [[ -f "$setup_script" ]] || die "Script schema non trovato: ${setup_script}"

    if ! command -v psql >/dev/null 2>&1; then
        log "psql non trovato: salto setup schema (esegui manualmente setup-dashboard.sh)"
        return
    fi

    log "Applico schema dashboard su ${DB_HOST}..."
    DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" \
        DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
        bash "$setup_script"
}

build_frontend() {
    local frontend_src="${SCRIPT_DIR}/frontend"
    local frontend_dst="${INSTALL_DIR}/frontend"
    local api_base="http://${PUBLIC_HOST}:${API_PORT}"

    mkdir -p "$frontend_dst"

    if [[ "$SKIP_FRONTEND" -eq 1 ]]; then
        if [[ -d "${frontend_src}/dist" ]]; then
            log "Copio dist/ esistente dal repo..."
            rm -rf "${frontend_dst}/dist"
            cp -r "${frontend_src}/dist" "${frontend_dst}/"
        elif [[ -d "${frontend_dst}/dist" ]]; then
            log "Uso dist/ già presente in ${frontend_dst}"
        else
            die "Nessun dist/ trovato. Esegui npm run build in frontend/ o rimuovi --skip-frontend"
        fi
        return
    fi

    command -v npm >/dev/null 2>&1 || die "npm non trovato. Installa nodejs o usa --skip-frontend con dist/ precompilato"
    [[ -f "${frontend_src}/package.json" ]] || die "Frontend non trovato in ${frontend_src}"

    log "Build frontend (VITE_API_BASE_URL=${api_base})..."
    cd "$frontend_src"
    if [[ -f package-lock.json ]]; then
        npm ci
    else
        npm install
    fi
    printf 'VITE_API_BASE_URL=%s\n' "$api_base" > .env.production.local
    npm run build
    rm -f .env.production.local

    rm -rf "${frontend_dst}/dist"
    cp -r "${frontend_src}/dist" "${frontend_dst}/"
    chown -R "${SERVICE_USER}:${SERVICE_USER}" "${frontend_dst}"
}

systemd_usable() {
    command -v systemctl >/dev/null 2>&1 || return 1
    if ! pidof systemd >/dev/null 2>&1 && [[ ! -d /run/systemd/system ]]; then
        return 1
    fi
    systemctl list-unit-files --type=service --no-legend >/dev/null 2>&1
}

install_systemd_service() {
    local service_path="/etc/systemd/system/${SERVICE_NAME}"
    local backend_dst="${INSTALL_DIR}/backend"

    if ! systemd_usable; then
        die "systemd non disponibile. Avvia manualmente: ${backend_dst}/start-api.sh"
    fi

    log "Installo servizio systemd ${SERVICE_NAME}..."
    cat >"$service_path" <<EOF
[Unit]
Description=Log Dashboard API (FastAPI)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${backend_dst}
EnvironmentFile=${ENV_FILE}
Environment=PYTHONPATH=${backend_dst}
ExecStart=${backend_dst}/start-api.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    chmod 644 "$service_path"
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"

    sleep 2
    systemctl is-active --quiet "$SERVICE_NAME" || die "Servizio ${SERVICE_NAME} non attivo. Vedi: journalctl -u ${SERVICE_NAME} -n 50"
    log "Servizio ${SERVICE_NAME} attivo"
}

install_nginx() {
    if [[ "$SKIP_NGINX" -eq 1 ]]; then
        log "Salto configurazione nginx (--skip-nginx)"
        return
    fi

    command -v nginx >/dev/null 2>&1 || die "nginx non installato"

    log "Configuro nginx in ${NGINX_CONF}..."
    cat >"$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${PUBLIC_HOST} _;

    root ${INSTALL_DIR}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    nginx -t
    systemctl enable nginx
    systemctl restart nginx
    log "nginx attivo su http://${PUBLIC_HOST}"
}

verify_deploy() {
    local api_base="http://${PUBLIC_HOST}:${API_PORT}"
    log "Verifica API ${api_base}/health ..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsS "${api_base}/health" >/dev/null || die "Health check fallito su ${api_base}/health"
        log "Health check OK"
    else
        log "curl non disponibile: salto health check"
    fi
}

show_summary() {
    cat <<EOF

Deploy completato.

Directory   : ${INSTALL_DIR}
Config API  : ${ENV_FILE}
Servizio    : ${SERVICE_NAME}
Frontend    : http://${PUBLIC_HOST}
API         : http://${PUBLIC_HOST}:${API_PORT}
Health      : http://${PUBLIC_HOST}:${API_PORT}/health

Comandi:
  sudo systemctl status ${SERVICE_NAME}
  journalctl -u ${SERVICE_NAME} -f
  sudo systemctl status nginx
  sudo nano ${ENV_FILE}

Aggiornamento (dopo rsync/git pull del repo):
  sudo ./deploy_log_dashboard.sh

Solo backend (senza rebuild frontend):
  sudo ./deploy_log_dashboard.sh --skip-frontend --skip-db-schema

Schema DB manuale (se saltato):
  DB_HOST=${DB_HOST} DB_PASSWORD=*** ${SCRIPT_DIR}/backend/sql/setup-dashboard.sh
EOF
}

main() {
    parse_args "$@"
    require_root
    log_public_host
    ensure_service_user
    install_packages
    ensure_nodejs
    write_env_file
    install_backend
    apply_db_schema
    build_frontend
    install_systemd_service
    install_nginx
    verify_deploy
    show_summary
}

main "$@"
