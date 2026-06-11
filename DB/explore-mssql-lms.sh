#!/usr/bin/env bash
# Esplora dbo.m06_log_produzione (LMS lms_010) per configurare WIN_log_aggregator.
#
# Uso:
#   MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./explore-mssql-lms.sh
#   cp mssql-lms.env.example .env   # compila MSSQL_USER/PASSWORD, poi ./explore-mssql-lms.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TABLE=m06_log_produzione

MSSQL_HOST="${MSSQL_HOST:-10.0.0.241}"
MSSQL_PORT="${MSSQL_PORT:-49543}"
MSSQL_USER="${MSSQL_USER:-}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-}"
MSSQL_DATABASE="${MSSQL_DATABASE:-lms_010}"

if [[ -f "${ROOT}/mssql-lms.env.example" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/mssql-lms.env.example"
  set +a
fi
if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

SERVER="${MSSQL_HOST},${MSSQL_PORT}"

if [[ -z "$MSSQL_USER" || -z "$MSSQL_PASSWORD" ]]; then
  cat >&2 <<EOF
Imposta MSSQL_USER e MSSQL_PASSWORD, ad esempio:

  MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./explore-mssql-lms.sh

Oppure crea ${ROOT}/.env a partire da mssql-lms.env.example:

  cp mssql-lms.env.example .env
  # modifica .env con user/password, poi:
  ./explore-mssql-lms.sh
EOF
  exit 1
fi

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

echo "======== ${TABLE} — colonne ========"
run_sql -Q "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${TABLE}' ORDER BY ORDINAL_POSITION"
echo "======== ${TABLE} — TOP 5 (ultimi per m06n_id) ========"
run_sql -Q "SELECT TOP 5 * FROM dbo.[${TABLE}] ORDER BY m06n_id DESC"
echo "======== ${TABLE} — tipi evento ========"
run_sql -Q "SELECT m06s_tipo, COUNT(*) AS n FROM dbo.[${TABLE}] GROUP BY m06s_tipo ORDER BY n DESC"

cat <<'EOF'

======== machines.yaml (LMS) ========
  mssql_table: dbo.m06_log_produzione
  mssql_id_column: m06n_id
  mssql_timestamp_column: m06d_data
  mssql_time_column: m06s_ora
  nome_pezzo: inserimento_corpo_sifone   # fisso; ogni riga = 1 evento conteggiato
EOF
