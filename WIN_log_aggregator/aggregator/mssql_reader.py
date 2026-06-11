from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, List, Optional, Tuple

from aggregator.config import MachineSource
from aggregator.parser import ParsedPiece

IDENT_PART = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _quote_table(name: str) -> str:
    parts = [part.strip() for part in name.split(".") if part.strip()]
    for part in parts:
        if not IDENT_PART.match(part):
            raise ValueError(f"Identificatore tabella non valido: {name}")
    return ".".join(f"[{part}]" for part in parts)


def _quote_column(name: str) -> str:
    if not IDENT_PART.match(name):
        raise ValueError(f"Identificatore colonna non valido: {name}")
    return f"[{name}]"


def _datetime_expr(date_col: str, time_col: Optional[str]) -> str:
    if time_col:
        return (
            f"CONVERT(datetime, CONVERT(varchar(10), {date_col}, 120) "
            f"+ ' ' + {time_col}, 120)"
        )
    return date_col


def _parse_datetime_watermark(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        return datetime.fromisoformat(value.strip())
    return None


def _parse_id_watermark(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def _coerce_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00")).replace(
            tzinfo=None
        )
    raise ValueError(f"Timestamp non supportato: {value!r}")


def _filter_clause(source: MachineSource) -> Tuple[str, List[Any]]:
    if not source.mssql_filter_column or not source.mssql_filter_value:
        return "", []
    col = _quote_column(source.mssql_filter_column)
    return f" AND {col} = ?", [source.mssql_filter_value]


def _connect(source: MachineSource):
    import pyodbc

    driver = source.mssql_driver
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={source.mssql_host},{source.mssql_port};"
        f"DATABASE={source.mssql_database};"
        f"UID={source.mssql_user};"
        f"PWD={source.mssql_password};"
        "TrustServerCertificate=yes;"
        "Encrypt=yes;"
    )
    return pyodbc.connect(conn_str, timeout=10)


def read_new_rows(
    source: MachineSource,
    watermark: Any,
) -> Tuple[List[ParsedPiece], Any]:
    table = _quote_table(source.mssql_table)
    date_col = _quote_column(source.mssql_timestamp_column)
    time_col = (
        _quote_column(source.mssql_time_column) if source.mssql_time_column else None
    )
    id_col = _quote_column(source.mssql_id_column) if source.mssql_id_column else None
    piece_col = (
        _quote_column(source.mssql_piece_column) if source.mssql_piece_column else None
    )
    machine_col = (
        _quote_column(source.mssql_machine_column) if source.mssql_machine_column else None
    )
    filter_sql, filter_params = _filter_clause(source)

    ts_expr = _datetime_expr(date_col, time_col)
    select_cols = [f"{ts_expr} AS event_ts"]
    if id_col:
        select_cols.insert(0, id_col)
    if piece_col:
        select_cols.append(piece_col)
    if machine_col:
        select_cols.append(machine_col)

    params: List[Any] = []
    if id_col:
        last_id = _parse_id_watermark(watermark)
        if last_id is None:
            since = datetime.now() - timedelta(hours=source.mssql_lookback_hours)
            query = (
                f"SELECT {', '.join(select_cols)} FROM {table} "
                f"WHERE {ts_expr} >= ?{filter_sql} ORDER BY {id_col}"
            )
            params = [since, *filter_params]
            new_watermark_from = "id"
        else:
            query = (
                f"SELECT {', '.join(select_cols)} FROM {table} "
                f"WHERE {id_col} > ?{filter_sql} ORDER BY {id_col}"
            )
            params = [last_id, *filter_params]
            new_watermark_from = "id"
    else:
        since = _parse_datetime_watermark(watermark)
        if since is None:
            since = datetime.now() - timedelta(hours=source.mssql_lookback_hours)
        query = (
            f"SELECT {', '.join(select_cols)} FROM {table} "
            f"WHERE {ts_expr} > ?{filter_sql} ORDER BY {ts_expr}"
        )
        params = [since, *filter_params]
        new_watermark_from = "timestamp"

    pieces: List[ParsedPiece] = []
    max_id: Optional[int] = None

    with _connect(source) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)

        for row in cursor.fetchall():
            idx = 0
            row_id: Optional[int] = None
            if id_col:
                row_id = int(row[idx])
                idx += 1
                if max_id is None or row_id > max_id:
                    max_id = row_id

            timestamp = _coerce_datetime(row[idx])
            idx += 1
            nome_pezzo = source.nome_pezzo
            if piece_col:
                raw_piece = row[idx]
                idx += 1
                if raw_piece is not None and str(raw_piece).strip():
                    nome_pezzo = str(raw_piece).strip()
            nome_macchinario = source.nome_macchinario
            if machine_col:
                raw_machine = row[idx]
                if raw_machine is not None and str(raw_machine).strip():
                    nome_macchinario = str(raw_machine).strip()

            raw_key = row_id if row_id is not None else timestamp.isoformat()
            pieces.append(
                ParsedPiece(
                    timestamp=timestamp,
                    nome_macchinario=nome_macchinario,
                    nome_pezzo=nome_pezzo,
                    raw_line=f"mssql:{source.mssql_table}:{raw_key}",
                )
            )

    if not pieces:
        if watermark is None and new_watermark_from == "id" and id_col:
            return [], 0
        return [], watermark

    if new_watermark_from == "id" and max_id is not None:
        return pieces, max_id

    new_watermark = max(p.timestamp for p in pieces).isoformat(sep=" ")
    return pieces, new_watermark
