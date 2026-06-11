#!/usr/bin/env bash
# Probe MSSQL da Linux (Rocky): TCP + query con sqlcmd o pymssql.
#
# Da Linux/Mac NON funziona Windows auth (-E): serve MSSQL_USER + MSSQL_PASSWORD.
#
# Uso:
#   ./probe-mssql.sh --lms
#   MSSQL_HOST=10.0.0.241 MSSQL_PORT=49543 MSSQL_USER=readonly MSSQL_PASSWORD=secret ./probe-mssql.sh
#   ./probe-mssql.sh --lms --tables
#
# Rocky: sudo ./install-mssql-client-rocky.sh
# Credenziali: copia mssql-lms.env.example in .env e compila MSSQL_USER/PASSWORD
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MSSQL_HOST="${MSSQL_HOST:-10.0.0.241}"
MSSQL_PORT="${MSSQL_PORT:-49543}"
MSSQL_INSTANCE="${MSSQL_INSTANCE:-MULTIDB_2022}"
MSSQL_USER="${MSSQL_USER:-}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-}"
MSSQL_DATABASE="${MSSQL_DATABASE:-lms_010}"
MSSQL_TIMEOUT_SEC="${MSSQL_TIMEOUT_SEC:-10}"
SHOW_TABLES=0
USE_LMS_PROFILE=0

log() { printf '[probe-mssql] %s\n' "$*"; }
warn() { printf '[probe-mssql] ATTENZIONE: %s\n' "$*" >&2; }
die() { printf '[probe-mssql] ERRORE: %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --lms) USE_LMS_PROFILE=1; shift ;;
      --tables) SHOW_TABLES=1; shift ;;
      --host) MSSQL_HOST="${2:-}"; shift 2 ;;
      --port) MSSQL_PORT="${2:-}"; shift 2 ;;
      --instance) MSSQL_INSTANCE="${2:-}"; shift 2 ;;
      --database) MSSQL_DATABASE="${2:-}"; shift 2 ;;
      --user) MSSQL_USER="${2:-}"; shift 2 ;;
      --password) MSSQL_PASSWORD="${2:-}"; shift 2 ;;
      -h|--help) usage ;;
      *) die "Opzione sconosciuta: $1 (usa --help)" ;;
    esac
  done
}

load_env() {
  # Non sovrascrivere credenziali passate da CLI (--user / MSSQL_USER=...)
  local saved_user="${MSSQL_USER:-}"
  local saved_password="${MSSQL_PASSWORD:-}"

  if [[ "$USE_LMS_PROFILE" -eq 1 && -f "${ROOT}/mssql-lms.env.example" ]]; then
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

  [[ -n "$saved_user" ]] && MSSQL_USER="$saved_user"
  [[ -n "$saved_password" ]] && MSSQL_PASSWORD="$saved_password"
}

mssql_server() {
  if [[ -n "$MSSQL_INSTANCE" && "$MSSQL_PORT" == "1433" ]]; then
    printf '%s\\%s' "$MSSQL_HOST" "$MSSQL_INSTANCE"
  else
    printf '%s,%s' "$MSSQL_HOST" "$MSSQL_PORT"
  fi
}

sql_query() {
  if [[ "$SHOW_TABLES" -eq 1 ]]; then
    cat <<'SQL'
SET NOCOUNT ON;
SELECT @@VERSION AS version;
SELECT name FROM sys.databases ORDER BY name;
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
SQL
  else
    cat <<'SQL'
SET NOCOUNT ON;
SELECT @@VERSION AS version;
SELECT name FROM sys.databases ORDER BY name;
SQL
  fi
}

probe_tcp() {
  local host="$1"
  local port="$2"
  local timeout_sec="$3"

  log "Test TCP ${host}:${port} (timeout ${timeout_sec}s) ..."
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w "$timeout_sec" "$host" "$port" 2>/dev/null; then
      log "TCP OK: porta ${port} raggiungibile su ${host}"
      return 0
    fi
    die "TCP FAIL: ${host}:${port} non raggiungibile (nc)"
  fi

  if (echo >/dev/tcp/"${host}"/"${port}") 2>/dev/null; then
    log "TCP OK: porta ${port} raggiungibile su ${host}"
    return 0
  fi

  die "TCP FAIL: ${host}:${port} non raggiungibile"
}

find_sqlcmd() {
  if command -v sqlcmd >/dev/null 2>&1; then
    command -v sqlcmd
    return 0
  fi

  local candidate
  for candidate in \
    "/opt/mssql-tools18/bin/sqlcmd" \
    "/opt/mssql-tools/bin/sqlcmd" \
    "/usr/local/bin/sqlcmd"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

probe_sql_sqlcmd() {
  local sqlcmd_bin server query_file
  server="$(mssql_server)"
  query_file="$(mktemp)"
  sql_query >"$query_file"

  log "Test SQL (sqlcmd) ${MSSQL_USER}@${server}/${MSSQL_DATABASE} ..."
  MSSQLCMDPASSWORD="$MSSQL_PASSWORD" "$sqlcmd_bin" \
    -S "$server" \
    -U "$MSSQL_USER" \
    -P "$MSSQL_PASSWORD" \
    -d "$MSSQL_DATABASE" \
    -l "$MSSQL_TIMEOUT_SEC" \
    -C \
    -i "$query_file"
  rm -f "$query_file"
  log "SQL OK (sqlcmd)"
}

probe_sql_python() {
  command -v python3 >/dev/null 2>&1 || return 1
  python3 -c "import pymssql" 2>/dev/null || return 1

  log "Test SQL (pymssql) ${MSSQL_USER}@${MSSQL_HOST}:${MSSQL_PORT}/${MSSQL_DATABASE} ..."
  MSSQL_HOST="$MSSQL_HOST" MSSQL_PORT="$MSSQL_PORT" MSSQL_USER="$MSSQL_USER" \
    MSSQL_PASSWORD="$MSSQL_PASSWORD" MSSQL_DATABASE="$MSSQL_DATABASE" \
    SHOW_TABLES="$SHOW_TABLES" python3 <<'PY'
import os
import pymssql

host = os.environ["MSSQL_HOST"]
port = int(os.environ["MSSQL_PORT"])
user = os.environ["MSSQL_USER"]
password = os.environ["MSSQL_PASSWORD"]
database = os.environ["MSSQL_DATABASE"]
show_tables = os.environ.get("SHOW_TABLES") == "1"

conn = pymssql.connect(server=host, port=port, user=user, password=password, database=database, login_timeout=10)
try:
    cur = conn.cursor()
    cur.execute("SELECT @@VERSION")
    print("version:", cur.fetchone()[0])
    cur.execute("SELECT name FROM sys.databases ORDER BY name")
    print("databases:", [row[0] for row in cur.fetchall()])
    if show_tables:
        cur.execute(
            "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
            "WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME"
        )
        for schema, name in cur.fetchall():
            print(f"table: {schema}.{name}")
finally:
    conn.close()
PY
  log "SQL OK (pymssql)"
}

probe_sql() {
  if [[ -z "$MSSQL_USER" ]]; then
    warn "MSSQL_USER non impostato: salto test SQL"
    warn "Da Rocky/Linux serve login SQL. Crea utente readonly su LMS, poi:"
    warn "  MSSQL_USER=readonly MSSQL_PASSWORD=... ./probe-mssql.sh --lms"
    return 0
  fi

  local sqlcmd_bin
  if sqlcmd_bin="$(find_sqlcmd)"; then
    probe_sql_sqlcmd "$sqlcmd_bin"
    return 0
  fi

  if probe_sql_python; then
    return 0
  fi

  warn "Nessun client SQL disponibile."
  warn "Rocky: sudo ./install-mssql-client-rocky.sh"
  warn "Oppure: pip install pymssql (richiede FreeTDS)"
}

main() {
  parse_args "$@"
  load_env
  log "Target: $(mssql_server) database=${MSSQL_DATABASE}"
  probe_tcp "$MSSQL_HOST" "$MSSQL_PORT" "$MSSQL_TIMEOUT_SEC"
  probe_sql
  log "Probe completato"
}

main "$@"
