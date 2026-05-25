#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/piece-counter"
ENV_FILE="/etc/piece-counter.env"
SERVICE_NAME="piece-counter.service"
SERVICE_USER="${SUDO_USER:-koman}"

NOME_MACCHINARIO=""
NOME_PEZZO=""
DB_HOST=""
DB_PORT="5432"
DB_NAME=""
DB_USER=""
DB_PASSWORD=""
GPIO_PIN="10"
DEBOUNCE_MS="200"

usage() {
    cat <<'EOF'
Deploy contatore pezzi su Raspberry Pi.

Uso:
  sudo ./deploy.sh
  sudo ./deploy.sh --nome-macchinario Linea1_MacchinaA --nome-pezzo ComponenteXYZ \
    --db-host 172.20.1.84 --db-name raspberry_counter --db-user counter --db-password CatisPg2026

Opzioni:
  --nome-macchinario   Nome univoco della macchina (obbligatorio)
  --nome-pezzo         Nome del pezzo prodotto (obbligatorio)
  --db-host            Indirizzo IP o hostname PostgreSQL (obbligatorio)
  --db-port            Porta PostgreSQL (default: 5432)
  --db-name            Nome database (obbligatorio)
  --db-user            Utente PostgreSQL (obbligatorio)
  --db-password        Password PostgreSQL (obbligatorio)
  --gpio-pin           Pin GPIO BCM (default: 10)
  --debounce-ms        Antirimbalzo in ms (default: 200)
  --service-user       Utente Linux del servizio (default: utente sudo o koman)
  -h, --help           Mostra questo messaggio

Senza opzioni, lo script chiede i valori in modo interattivo.
EOF
}

log() {
    printf '[deploy] %s\n' "$*"
}

die() {
    printf '[deploy] ERRORE: %s\n' "$*" >&2
    exit 1
}

require_root() {
    if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
        die "Esegui lo script con sudo: sudo ./deploy.sh"
    fi
}

prompt_value() {
    local var_name="$1"
    local prompt_text="$2"
    local default_value="${3:-}"
    local secret="${4:-false}"
    local input=""

    if [[ -n "$default_value" ]]; then
        prompt_text="${prompt_text} [${default_value}]"
    fi

    if [[ "$secret" == "true" ]]; then
        read -r -s -p "${prompt_text}: " input
        echo
    else
        read -r -p "${prompt_text}: " input
    fi

    if [[ -z "$input" && -n "$default_value" ]]; then
        input="$default_value"
    fi

    printf -v "$var_name" '%s' "$input"
}

validate_required() {
    local missing=0
    local field value

    for field in NOME_MACCHINARIO NOME_PEZZO DB_HOST DB_NAME DB_USER DB_PASSWORD; do
        value="${!field}"
        if [[ -z "$value" ]]; then
            log "Campo obbligatorio mancante: ${field}"
            missing=1
        fi
    done

    if [[ "$missing" -eq 1 ]]; then
        die "Compila tutti i campi obbligatori."
    fi
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --nome-macchinario)
                NOME_MACCHINARIO="$2"
                shift 2
                ;;
            --nome-pezzo)
                NOME_PEZZO="$2"
                shift 2
                ;;
            --db-host)
                DB_HOST="$2"
                shift 2
                ;;
            --db-port)
                DB_PORT="$2"
                shift 2
                ;;
            --db-name)
                DB_NAME="$2"
                shift 2
                ;;
            --db-user)
                DB_USER="$2"
                shift 2
                ;;
            --db-password)
                DB_PASSWORD="$2"
                shift 2
                ;;
            --gpio-pin)
                GPIO_PIN="$2"
                shift 2
                ;;
            --debounce-ms)
                DEBOUNCE_MS="$2"
                shift 2
                ;;
            --service-user)
                SERVICE_USER="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                die "Opzione sconosciuta: $1 (usa --help)"
                ;;
        esac
    done
}

collect_inputs() {
    if [[ -z "$NOME_MACCHINARIO" ]]; then
        prompt_value NOME_MACCHINARIO "Nome macchinario"
    fi
    if [[ -z "$NOME_PEZZO" ]]; then
        prompt_value NOME_PEZZO "Nome pezzo"
    fi
    if [[ -z "$DB_HOST" ]]; then
        prompt_value DB_HOST "Indirizzo PostgreSQL (IP o hostname)" "172.20.1.84"
    fi
    if [[ -z "$DB_PORT" ]]; then
        prompt_value DB_PORT "Porta PostgreSQL" "5432"
    fi
    if [[ -z "$DB_NAME" ]]; then
        prompt_value DB_NAME "Nome database" "raspberry_counter"
    fi
    if [[ -z "$DB_USER" ]]; then
        prompt_value DB_USER "Utente PostgreSQL" "counter"
    fi
    if [[ -z "$DB_PASSWORD" ]]; then
        prompt_value DB_PASSWORD "Password PostgreSQL" "" true
    fi
    if [[ -z "$GPIO_PIN" ]]; then
        prompt_value GPIO_PIN "Pin GPIO BCM" "10"
    fi
    if [[ -z "$DEBOUNCE_MS" ]]; then
        prompt_value DEBOUNCE_MS "Antirimbalzo (ms)" "200"
    fi
}

write_env_file() {
    log "Scrivo configurazione in ${ENV_FILE}"
    cat >"$ENV_FILE" <<EOF
# Generato da deploy.sh il $(date -Iseconds)
NOME_MACCHINARIO=${NOME_MACCHINARIO}
NOME_PEZZO=${NOME_PEZZO}

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

GPIO_PIN=${GPIO_PIN}
DEBOUNCE_MS=${DEBOUNCE_MS}
EOF
    chmod 600 "$ENV_FILE"
    chown "${SERVICE_USER}:${SERVICE_USER}" "$ENV_FILE"
}

install_application() {
    log "Installo applicazione in ${INSTALL_DIR}"

    mkdir -p "$INSTALL_DIR"
    cp -r "${SCRIPT_DIR}/piece_counter" "$INSTALL_DIR/"
    cp "${SCRIPT_DIR}/requirements.txt" "$INSTALL_DIR/"

    if [[ ! -d "${INSTALL_DIR}/.venv" ]]; then
        log "Creo virtualenv Python"
        python3 -m venv "${INSTALL_DIR}/.venv"
    fi

    log "Installo dipendenze Python"
    "${INSTALL_DIR}/.venv/bin/pip" install --upgrade pip
    "${INSTALL_DIR}/.venv/bin/pip" install -r "${INSTALL_DIR}/requirements.txt"

    chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR"
}

install_systemd_service() {
    local service_path="/etc/systemd/system/${SERVICE_NAME}"

    if ! command -v systemctl >/dev/null 2>&1; then
        die "systemd non trovato. Impossibile installare il servizio."
    fi

    log "Configuro permessi GPIO per l'utente ${SERVICE_USER}"
    if getent group gpio >/dev/null 2>&1; then
        usermod -aG gpio "$SERVICE_USER" || true
    else
        log "Gruppo gpio non presente, salto (potrebbe servire su Raspberry Pi OS recente)"
    fi

    log "Creo unit file systemd in ${service_path}"
    cat >"$service_path" <<EOF
[Unit]
Description=Contatore pezzi produzione (GPIO -> PostgreSQL)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
SupplementaryGroups=gpio
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_DIR}/.venv/bin/python -m piece_counter.counter
Restart=always
RestartSec=5
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
EOF

    chmod 644 "$service_path"

    log "Abilito e avvio il servizio ${SERVICE_NAME}"
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"

    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "Servizio ${SERVICE_NAME} attivo"
    else
        log "ATTENZIONE: il servizio non risulta attivo. Output diagnostico:"
        systemctl status "$SERVICE_NAME" --no-pager -l || true
        die "Deploy completato ma il servizio non e' partito. Controlla: journalctl -u ${SERVICE_NAME} -n 50"
    fi
}

show_summary() {
    cat <<EOF

Deploy completato.

Macchinario : ${NOME_MACCHINARIO}
Pezzo       : ${NOME_PEZZO}
Database    : ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}
GPIO        : ${GPIO_PIN} (BCM)
Servizio    : ${SERVICE_NAME}

Comandi utili:
  sudo systemctl status ${SERVICE_NAME}
  journalctl -u ${SERVICE_NAME} -f

Verifica conteggi su PostgreSQL:
  SELECT * FROM conteggi_pezzi
  WHERE nome_macchinario = '${NOME_MACCHINARIO}'
  ORDER BY timestamp DESC LIMIT 10;

EOF
}

main() {
    parse_args "$@"

    if [[ $# -eq 0 || -z "$NOME_MACCHINARIO" || -z "$DB_PASSWORD" ]]; then
        echo "=== Deploy contatore pezzi ==="
        echo
    fi

    collect_inputs
    validate_required
    require_root

    if ! id "$SERVICE_USER" >/dev/null 2>&1; then
        die "Utente servizio inesistente: ${SERVICE_USER}"
    fi

    if ! command -v python3 >/dev/null 2>&1; then
        die "python3 non trovato. Installalo prima di procedere."
    fi

    install_application
    write_env_file
    install_systemd_service
    show_summary
}

main "$@"
