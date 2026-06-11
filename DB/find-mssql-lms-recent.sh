#!/usr/bin/env bash
# Trova date recenti nel DB LMS: singolo database o tutti i DB sull'istanza.
#
# Uso:
#   ./find-mssql-lms-recent.sh                      # scan colonne date in lms_010
#   ./find-mssql-lms-recent.sh --all-databases      # tabelle chiave su tutti i DB
#   ./find-mssql-lms-recent.sh --all-databases --full
#   ./find-mssql-lms-recent.sh --list-databases
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOP_N=40
ALL_DATABASES=0
FULL_SCAN=0
LIST_DATABASES=0

MSSQL_HOST="${MSSQL_HOST:-10.0.0.241}"
MSSQL_PORT="${MSSQL_PORT:-49543}"
MSSQL_USER="${MSSQL_USER:-}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-}"
MSSQL_DATABASE="${MSSQL_DATABASE:-lms_010}"

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
  echo
  echo "Opzioni:"
  echo "  --all-databases   Cerca su tutti i DB dell'istanza (non solo lms_010)"
  echo "  --full            Con --all-databases: scan tutte le colonne date (lento)"
  echo "  --list-databases  Elenca i database raggiungibili"
  echo "  --top N           Righe da mostrare (default: 40)"
  echo "  -h, --help"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all-databases) ALL_DATABASES=1; shift ;;
    --full) FULL_SCAN=1; shift ;;
    --list-databases) LIST_DATABASES=1; shift ;;
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

  MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./find-mssql-lms-recent.sh --all-databases

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

run_sql() {
  local db="${1:-master}"
  shift
  MSSQLCMDPASSWORD="$MSSQL_PASSWORD" "$SQLCMD" \
    -S "$SERVER" -U "$MSSQL_USER" -P "$MSSQL_PASSWORD" \
    -d "$db" -C -W -s ";" "$@"
}

list_databases() {
  run_sql master -h -1 -Q "
SET NOCOUNT ON;
SELECT name
FROM sys.databases
WHERE state_desc = 'ONLINE'
  AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
ORDER BY name;
"
}

SQL_KEY_TABLES="$(mktemp)"
SQL_FULL_SCAN="$(mktemp)"
trap 'rm -f "$SQL_KEY_TABLES" "$SQL_FULL_SCAN"' EXIT

cat >"$SQL_KEY_TABLES" <<'EOSQL'
SET NOCOUNT ON;

IF OBJECT_ID('dbo.o02_eventi_ordini') IS NOT NULL
BEGIN
  SELECT 'o02_eventi_ordini' AS tbl, 'max_o02d_data_evento' AS metric,
    CONVERT(varchar(19), MAX(o02d_data_evento), 120) AS last_ts
  FROM dbo.o02_eventi_ordini;
  SELECT 'o02_eventi_ordini', 'FINE LAVORAZIONE',
    CONVERT(varchar(19), MAX(CONVERT(datetime,
      CONVERT(varchar(10), o02d_data_evento, 120) + ' ' + o02s_ora_evento, 120)), 120)
  FROM dbo.o02_eventi_ordini
  WHERE o02s_stato = 'FINE LAVORAZIONE';
END

IF OBJECT_ID('dbo.o01_ordini') IS NOT NULL
BEGIN
  SELECT 'o01_ordini', 'max_o01d_data_ora_import',
    CONVERT(varchar(19), MAX(o01d_data_ora_import), 120)
  FROM dbo.o01_ordini;
  SELECT 'o01_ordini', 'max_o01d_data_richiesta',
    CONVERT(varchar(19), MAX(o01d_data_richiesta), 120)
  FROM dbo.o01_ordini;
END

IF OBJECT_ID('dbo.m06_log_produzione') IS NOT NULL
BEGIN
  SELECT 'm06_log_produzione', 'max_m06d_data',
    CONVERT(varchar(19), MAX(m06d_data), 120)
  FROM dbo.m06_log_produzione;
  SELECT 'm06_log_produzione', 'max_data_ora',
    CONVERT(varchar(19), MAX(CONVERT(datetime,
      CONVERT(varchar(10), m06d_data, 120) + ' ' + m06s_ora, 120)), 120)
  FROM dbo.m06_log_produzione;
END

IF OBJECT_ID('dbo.m07_export_eventi') IS NOT NULL
BEGIN
  SELECT 'm07_export_eventi', 'max_m07d_data',
    CONVERT(varchar(19), MAX(m07d_data), 120)
  FROM dbo.m07_export_eventi;
END
EOSQL

cat >"$SQL_FULL_SCAN" <<'EOSQL'
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
  SET @sql = N'INSERT INTO #last (tbl, col, last_ts) SELECT @tbl, @col, MAX('
    + QUOTENAME(@col) + N') FROM ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table);

  BEGIN TRY
    EXEC sp_executesql @sql, N'@tbl varchar(256), @col varchar(128)', @tbl, @col;
  END TRY
  BEGIN CATCH
  END CATCH;

  FETCH NEXT FROM c INTO @schema, @table, @col;
END

CLOSE c;
DEALLOCATE c;

SELECT tbl, col, CONVERT(varchar(19), last_ts, 120) AS last_ts
FROM #last
WHERE last_ts IS NOT NULL
ORDER BY last_ts DESC;
EOSQL

printf '[find-recent] Ora Rocky: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
printf '[find-recent] Server: %s\n' "$SERVER"

if [[ "$LIST_DATABASES" -eq 1 ]]; then
  echo "[find-recent] Database online:"
  list_databases
  exit 0
fi

run_sql master -Q "SELECT GETDATE() AS sql_server_ora;" 2>/dev/null || true
echo

if [[ "$ALL_DATABASES" -eq 0 ]]; then
  printf '[find-recent] Database: %s (scan colonne date, top %s)\n\n' "$MSSQL_DATABASE" "$TOP_N"
  {
    run_sql "$MSSQL_DATABASE" -i "$SQL_FULL_SCAN" 2>/dev/null || true
  } | head -n "$((TOP_N + 5))"
  exit 0
fi

printf '[find-recent] Modalita: tutti i database'
[[ "$FULL_SCAN" -eq 1 ]] && printf ' (scan completo colonne date)'
printf '\n\n'

mapfile -t DBS < <(list_databases)
COMBINED="$(mktemp)"
trap 'rm -f "$SQL_KEY_TABLES" "$SQL_FULL_SCAN" "$COMBINED"' EXIT

for db in "${DBS[@]}"; do
  [[ -n "$db" ]] || continue
  db="$(echo "$db" | tr -d '[:space:]')"
  [[ -n "$db" ]] || continue

  if [[ "$FULL_SCAN" -eq 1 ]]; then
    while IFS=';' read -r tbl col last_ts; do
      [[ -n "$tbl" && "$tbl" != "tbl" ]] || continue
      [[ -n "$last_ts" ]] || continue
      printf '%s;%s;%s;%s\n' "$db" "$tbl" "$col" "$last_ts"
    done < <(run_sql "$db" -i "$SQL_FULL_SCAN" 2>/dev/null || true)
  else
    while IFS=';' read -r tbl metric last_ts; do
      [[ -n "$tbl" && "$tbl" != "tbl" ]] || continue
      [[ -n "$last_ts" && "$last_ts" != "NULL" ]] || continue
      printf '%s;%s;%s;%s\n' "$db" "$tbl" "$metric" "$last_ts"
    done < <(run_sql "$db" -i "$SQL_KEY_TABLES" 2>/dev/null || true)
  fi
done >"$COMBINED"

echo "db_name;table;metric;last_ts"
sort -t';' -k4,4r "$COMBINED" | head -n "$TOP_N"

echo
echo "[find-recent] Database trovati: ${#DBS[@]} — usa --list-databases per l'elenco"
