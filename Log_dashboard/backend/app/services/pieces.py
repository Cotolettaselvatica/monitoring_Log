from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app import db
from app.schemas import LogEntry
from app.services.utils import iso


def _row_to_log(row: dict[str, Any], machine_id: str) -> LogEntry:
    return LogEntry(
        id=f"l-{row['id']}",
        machineId=machine_id,
        timestamp=iso(row["timestamp"]),
        action="PIECE_COUNT",
        level="info",
        message=f"Pezzo prodotto: {row['nome_pezzo']}",
        user="sistema",
    )


def list_logs(limit: int = 500, machine_nome: str | None = None) -> list[LogEntry]:
    if machine_nome:
        rows = db.fetch_all(
            """
            SELECT cp.id, cp.nome_macchinario, cp.nome_pezzo, cp.timestamp, dm.id AS machine_id
            FROM conteggi_pezzi cp
            LEFT JOIN dashboard_macchinari dm ON dm.nome_macchinario = cp.nome_macchinario
            WHERE cp.nome_macchinario = %s
            ORDER BY cp.timestamp DESC
            LIMIT %s
            """,
            (machine_nome, limit),
        )
    else:
        rows = db.fetch_all(
            """
            SELECT cp.id, cp.nome_macchinario, cp.nome_pezzo, cp.timestamp, dm.id AS machine_id
            FROM conteggi_pezzi cp
            LEFT JOIN dashboard_macchinari dm ON dm.nome_macchinario = cp.nome_macchinario
            ORDER BY cp.timestamp DESC
            LIMIT %s
            """,
            (limit,),
        )

    logs: list[LogEntry] = []
    for row in rows:
        machine_id = row.get("machine_id") or row["nome_macchinario"]
        logs.append(_row_to_log(row, machine_id))
    return logs


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
