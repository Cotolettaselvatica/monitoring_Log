from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app import db
from app.schemas import LogEntry
from app.services.utils import iso


def _table_exists(name: str) -> bool:
    row = db.fetch_one(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        ) AS ok
        """,
        (name,),
    )
    return bool(row and row["ok"])


def _row_to_log_entry(row: dict[str, Any]) -> LogEntry:
    return LogEntry(
        id=row["id"],
        machineId=row["machine_id"],
        timestamp=iso(row["timestamp"]),
        action=row["action"],
        level=row["level"],
        message=row["message"],
        user=row["user"],
    )


def _logs_union_sql(machine_nome: str | None = None) -> tuple[str, list[Any]]:
    params: list[Any] = []
    piece_where = ""
    ping_where = ""
    if machine_nome:
        piece_where = "WHERE cp.nome_macchinario = %s"
        ping_where = "WHERE pc.nome_macchinario = %s"
        params.extend([machine_nome, machine_nome])

    ping_union = ""
    if _table_exists("ping_checks"):
        ping_union = f"""
            UNION ALL
            SELECT
                'ping-' || pc.id::text AS id,
                COALESCE(dm2.id, pc.nome_macchinario) AS machine_id,
                pc.timestamp,
                'PING_CHECK' AS action,
                CASE WHEN pc.reachable THEN 'info' ELSE 'error' END AS level,
                CASE WHEN pc.reachable
                    THEN 'Ping OK (' || pc.ip || ')'
                    ELSE 'Ping fallito (' || pc.ip || ')'
                END AS message,
                'sistema' AS user
            FROM ping_checks pc
            LEFT JOIN dashboard_macchinari dm2 ON dm2.nome_macchinario = pc.nome_macchinario
            {ping_where}
        """

    sql = f"""
        SELECT * FROM (
            SELECT
                'p-' || cp.id::text AS id,
                COALESCE(dm.id, cp.nome_macchinario) AS machine_id,
                cp.timestamp,
                'PIECE_COUNT' AS action,
                'info'::text AS level,
                ('Pezzo prodotto: ' || cp.nome_pezzo) AS message,
                'sistema' AS user
            FROM conteggi_pezzi cp
            LEFT JOIN dashboard_macchinari dm ON dm.nome_macchinario = cp.nome_macchinario
            {piece_where}
            {ping_union}
        ) combined
        ORDER BY timestamp DESC
        LIMIT %s
    """
    return sql, params


def list_logs(limit: int = 2000, machine_nome: str | None = None) -> list[LogEntry]:
    sql, params = _logs_union_sql(machine_nome)
    rows = db.fetch_all(sql, (*params, limit))
    return [_row_to_log_entry(row) for row in rows]


def list_logs_for_machine_id(machine_id: str, limit: int = 500) -> list[LogEntry]:
    machine = db.fetch_one(
        "SELECT nome_macchinario FROM dashboard_macchinari WHERE id = %s",
        (machine_id,),
    )
    if not machine:
        return []
    return list_logs(limit=limit, machine_nome=machine["nome_macchinario"])


def activity_stats(since: datetime, machine_nome: str | None = None) -> dict[str, Any]:
    params: list[Any] = [since]
    filter_sql = ""
    if machine_nome:
        filter_sql = "AND nome_macchinario = %s"
        params.append(machine_nome)

    row = db.fetch_one(
        f"""
        SELECT COUNT(*) AS event_count,
               MIN(timestamp) AS first_ts,
               MAX(timestamp) AS last_ts
        FROM conteggi_pezzi
        WHERE timestamp >= %s {filter_sql}
        """,
        tuple(params),
    )
    return row or {"event_count": 0, "first_ts": None, "last_ts": None}


def hourly_counts(since: datetime, machine_nome: str | None = None) -> list[dict[str, Any]]:
    params: list[Any] = [since]
    filter_sql = ""
    if machine_nome:
        filter_sql = "AND nome_macchinario = %s"
        params.append(machine_nome)

    return db.fetch_all(
        f"""
        SELECT date_trunc('hour', timestamp AT TIME ZONE 'UTC') AS bucket,
               COUNT(*) AS count
        FROM conteggi_pezzi
        WHERE timestamp >= %s {filter_sql}
        GROUP BY 1
        ORDER BY 1
        """,
        tuple(params),
    )


def bucket_counts(
    trunc_unit: str,
    since: datetime,
    machine_nome: str | None = None,
) -> list[dict[str, Any]]:
    params: list[Any] = [since]
    filter_sql = ""
    if machine_nome:
        filter_sql = "AND nome_macchinario = %s"
        params.append(machine_nome)

    return db.fetch_all(
        f"""
        SELECT date_trunc(%s, timestamp AT TIME ZONE 'UTC') AS bucket,
               COUNT(*) AS count
        FROM conteggi_pezzi
        WHERE timestamp >= %s {filter_sql}
        GROUP BY 1
        ORDER BY 1
        """,
        (trunc_unit, *params),
    )


def distinct_machines_from_production() -> list[dict[str, Any]]:
    return db.fetch_all(
        """
        SELECT nome_macchinario,
               MAX(timestamp) AS last_seen,
               COUNT(*) AS total_pieces
        FROM conteggi_pezzi
        GROUP BY nome_macchinario
        ORDER BY nome_macchinario
        """
    )


def distinct_machines_from_pings() -> list[dict[str, Any]]:
    if not _table_exists("ping_checks"):
        return []
    return db.fetch_all(
        """
        SELECT nome_macchinario,
               MAX(timestamp) AS last_seen,
               0 AS total_pieces
        FROM ping_checks
        GROUP BY nome_macchinario
        ORDER BY nome_macchinario
        """
    )


def production_since(since: datetime) -> list[dict[str, Any]]:
    return db.fetch_all(
        """
        SELECT nome_macchinario,
               COUNT(*) AS count,
               MAX(timestamp) AS last_seen
        FROM conteggi_pezzi
        WHERE timestamp >= %s
        GROUP BY nome_macchinario
        """,
        (since,),
    )


def count_events_in_window(
    machine_nome: str,
    start: datetime,
    end: datetime,
) -> int:
    row = db.fetch_one(
        """
        SELECT COUNT(*) AS count
        FROM conteggi_pezzi
        WHERE nome_macchinario = %s AND timestamp >= %s AND timestamp < %s
        """,
        (machine_nome, start, end),
    )
    return int(row["count"]) if row else 0
