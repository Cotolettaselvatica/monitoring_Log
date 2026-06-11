#!/usr/bin/env bash
# Installa sqlcmd (mssql-tools18) su Rocky/RHEL 9 per probe-mssql.sh
# Uso: sudo ./install-mssql-client-rocky.sh
set -euo pipefail

log() { printf '[install-mssql-client] %s\n' "$*"; }
die() { printf '[install-mssql-client] ERRORE: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Esegui con sudo"

command -v dnf >/dev/null 2>&1 || die "Serve Rocky/RHEL con dnf"

log "Aggiungo repo Microsoft..."
curl -fsSL https://packages.microsoft.com/config/rhel/9/prod.repo -o /etc/yum.repos.d/mssql-release.repo

log "Installo ODBC driver e sqlcmd..."
ACCEPT_EULA=Y dnf install -y msodbcsql18 mssql-tools18 unixODBC

if [[ -x /opt/mssql-tools18/bin/sqlcmd ]]; then
  ln -sf /opt/mssql-tools18/bin/sqlcmd /usr/local/bin/sqlcmd
fi

log "Verifica:"
sqlcmd -?
log "Installazione completata. Poi:"
log "  cd DB && cp mssql-lms.env.example .env   # imposta MSSQL_USER/PASSWORD"
log "  ./probe-mssql.sh --lms"
