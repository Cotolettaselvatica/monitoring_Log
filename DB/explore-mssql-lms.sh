#!/usr/bin/env bash
# Esplora schema e campioni tabelle LMS (lms_010) per configurare WIN_log_aggregator.
# Uso: MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./explore-mssql-lms.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TABLES=(m06_log_produzione o02_eventi_ordini m07_export_eventi c12_codici_evento)

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

MSSQL_HOST="${MSSQL_HOST:-10.0.0.241}"
MSSQL_PORT="${MSSQL_PORT:-49543}"
MSSQL_USER="${MSSQL_USER:-}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-}"
MSSQL_DATABASE="${MSSQL_DATABASE:-lms_010}"
SERVER="${MSSQL_HOST},${MSSQL_PORT}"

[[ -n "$MSSQL_USER" ]] || { echo "Imposta MSSQL_USER e MSSQL_PASSWORD" >&2; exit 1; }

SQLCMD=""
for c in sqlcmd /opt/mssql-tools18/bin/sqlcmd /usr/local/bin/sqlcmd; do
  if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then
    SQLCMD="$c"
    break
  fi
done
[[ -n "$SQLCMD" ]] || { echo "sqlcmd non trovato. Esegui install-mssql-client-rocky.sh" >&2; exit 1; }

run_sql() {
  MSSQLCMDPASSWORD="$MSSQL_PASSWORD" "$SQLCMD" \
    -S "$SERVER" -U "$MSSQL_USER" -P "$MSSQL_PASSWORD" \
    -d "$MSSQL_DATABASE" -C -W -s ";" "$@"
}

for table in "${TABLES[@]}"; do
  echo "======== ${table} — colonne ========"
  run_sql -Q "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION"
  echo "======== ${table} — TOP 5 ========"
  run_sql -Q "SELECT TOP 5 * FROM dbo.[${table}] ORDER BY 1 DESC" || echo "(query fallita)"
  echo
done
