#!/usr/bin/env bash
# Trova le colonne date/datetime con valori più recenti in tutte le tabelle di lms_010.
#
# Uso:
#   MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./find-mssql-lms-recent.sh
#   ./find-mssql-lms-recent.sh --top 20
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOP_N=40

MSSQL_HOST="${MSSQL_HOST:-10.0.0.241}"
MSSQL_PORT="${MSSQL_PORT:-49543}"
MSSQL_USER="${MSSQL_USER:-}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-}"
MSSQL_DATABASE="${MSSQL_DATABASE:-lms_010}"

usage() {
  sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
  echo
  echo "Opzioni:"
  echo "  --top N   Mostra le N colonne più recenti (default: 40)"
  echo "  -h, --help"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --top) TOP_N="${2:-40}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opzione sconosciuta: $1" >&2; usage; exit 1 ;;
  esac
done

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

if [[ -z "$MSSQL_USER" || -z "$MSSQL_PASSWORD" ]]; then
  cat >&2 <<EOF
Imposta MSSQL_USER e MSSQL_PASSWORD, ad esempio:

  MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./find-mssql-lms-recent.sh

Oppure crea ${ROOT}/.env a partire da mssql-lms.env.example.
EOF
  exit 1
fi

SERVER="${MSSQL_HOST},${MSSQL_PORT}"
SQLCMD=""
for c in sqlcmd /opt/mssql-tools18/bin/sqlcmd /usr/local/bin/sqlcmd; do
  if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then
    SQLCMD="$c"
    break
  fi
done
[[ -n "$SQLCMD" ]] || { echo "sqlcmd non trovato. Esegui install-mssql-client-rocky.sh" >&2; exit 1; }

SQL_FILE="$(mktemp)"
trap 'rm -f "$SQL_FILE"' EXIT

cat >"$SQL_FILE" <<EOSQL
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#last') IS NOT NULL DROP TABLE #last;
CREATE TABLE #last (
  tbl varchar(256),
  col varchar(128),
  last_ts datetime
);

DECLARE @schema sysname, @table sysname, @col sysname, @sql nvarchar(max);
DECLARE @tbl varchar(256);

DECLARE c CURSOR LOCAL FAST_FORWARD FOR
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE DATA_TYPE IN ('datetime', 'datetime2', 'smalldatetime', 'date')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

OPEN c;
FETCH NEXT FROM c INTO @schema, @table, @col;

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @tbl = @schema + '.' + @table;
  SET @sql = N'
    INSERT INTO #last (tbl, col, last_ts)
    SELECT N''' + REPLACE(@tbl, '''', '''''') + N''', N''' + REPLACE(@col, '''', '''''') + N''', MAX(' + QUOTENAME(@col) + N')
    FROM ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table) + N';';

  BEGIN TRY
    EXEC sp_executesql @sql;
  END TRY
  BEGIN CATCH
  END CATCH;

  FETCH NEXT FROM c INTO @schema, @table, @col;
END

CLOSE c;
DEALLOCATE c;

SELECT GETDATE() AS sql_server_ora;

SELECT TOP (${TOP_N})
  tbl,
  col,
  CONVERT(varchar(19), last_ts, 120) AS last_ts
FROM #last
WHERE last_ts IS NOT NULL
ORDER BY last_ts DESC;
EOSQL

printf '[find-recent] Ora Rocky: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
printf '[find-recent] Database: %s @ %s (top %s)\n' "$MSSQL_DATABASE" "$SERVER" "$TOP_N"
printf '[find-recent] Nota: non combina colonne data+ora separate (es. o02d_data_evento + o02s_ora_evento)\n\n'

MSSQLCMDPASSWORD="$MSSQL_PASSWORD" "$SQLCMD" \
  -S "$SERVER" -U "$MSSQL_USER" -P "$MSSQL_PASSWORD" \
  -d "$MSSQL_DATABASE" -C -W -s ";" \
  -i "$SQL_FILE"
