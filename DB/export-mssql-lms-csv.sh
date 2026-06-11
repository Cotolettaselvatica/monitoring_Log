#!/usr/bin/env bash
# Esporta tutte le tabelle di lms_010 in CSV (una file per tabella).
#
# Uso:
#   MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./export-mssql-lms-csv.sh
#   ./export-mssql-lms-csv.sh --out /tmp/lms_csv
#   ./export-mssql-lms-csv.sh --zip
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR=""
MAKE_ZIP=0

MSSQL_HOST="${MSSQL_HOST:-10.0.0.241}"
MSSQL_PORT="${MSSQL_PORT:-49543}"
MSSQL_USER="${MSSQL_USER:-}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-}"
MSSQL_DATABASE="${MSSQL_DATABASE:-lms_010}"

usage() {
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
  echo
  echo "Opzioni:"
  echo "  --out DIR   Cartella output (default: ${ROOT}/exports/lms_010_<timestamp>)"
  echo "  --zip       Crea anche lms_010_csv.tar.gz nella cartella padre di --out"
  echo "  -h, --help  Mostra questo messaggio"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) OUT_DIR="${2:-}"; shift 2 ;;
    --zip) MAKE_ZIP=1; shift ;;
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

  MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./export-mssql-lms-csv.sh

Oppure crea ${ROOT}/.env a partire da mssql-lms.env.example.
EOF
  exit 1
fi

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="${ROOT}/exports/lms_010_$(date +%Y%m%d_%H%M%S)"
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

mkdir -p "$OUT_DIR"
MANIFEST="${OUT_DIR}/_manifest.txt"

run_sql() {
  MSSQLCMDPASSWORD="$MSSQL_PASSWORD" "$SQLCMD" \
    -S "$SERVER" -U "$MSSQL_USER" -P "$MSSQL_PASSWORD" \
    -d "$MSSQL_DATABASE" -C "$@"
}

log() { printf '[export-lms] %s\n' "$*"; }

log "Database: ${MSSQL_DATABASE} @ ${SERVER}"
log "Output: ${OUT_DIR}"

{
  echo "# Export ${MSSQL_DATABASE} $(date -Iseconds)"
  echo "# host=${SERVER}"
  echo "# table;rows;file"
} >"$MANIFEST"

mapfile -t TABLES < <(
  run_sql -h -1 -W -Q "
SET NOCOUNT ON;
SELECT TABLE_SCHEMA + '.' + TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
"
)

if [[ ${#TABLES[@]} -eq 0 ]]; then
  echo "Nessuna tabella trovata in ${MSSQL_DATABASE}" >&2
  exit 1
fi

log "Tabelle da esportare: ${#TABLES[@]}"

for qualified in "${TABLES[@]}"; do
  [[ -n "$qualified" ]] || continue
  schema="${qualified%%.*}"
  table="${qualified#*.}"
  outfile="${OUT_DIR}/${schema}.${table}.csv"

  log "  ${qualified} -> $(basename "$outfile")"

  run_sql -s ";" -W -h -1 -Q "SELECT * FROM [${schema}].[${table}]" -o "$outfile"

  row_estimate="$(
    run_sql -h -1 -W -Q "
SET NOCOUNT ON;
SELECT SUM(p.rows)
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
WHERE t.name = '${table}' AND SCHEMA_NAME(t.schema_id) = '${schema}';
" | tr -d '[:space:]'
  )"
  [[ -n "$row_estimate" ]] || row_estimate="?"

  echo "${qualified};${row_estimate};${schema}.${table}.csv" >>"$MANIFEST"
done

log "Manifest: ${MANIFEST}"

if [[ "$MAKE_ZIP" -eq 1 ]]; then
  archive="$(dirname "$OUT_DIR")/$(basename "$OUT_DIR").tar.gz"
  tar -czf "$archive" -C "$(dirname "$OUT_DIR")" "$(basename "$OUT_DIR")"
  log "Archivio: ${archive}"
fi

log "Fatto. Copia sul Mac: scp -r root@<rocky>:${OUT_DIR} ."
