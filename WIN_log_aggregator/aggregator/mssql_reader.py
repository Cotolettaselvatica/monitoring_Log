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


def _parse_watermark(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        return datetime.fromisoformat(value.strip())
    return None


def _coerce_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00")).replace(tzinfo=None)
    raise ValueError(f"Timestamp non supportato: {value!r}")


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
    ts_col = _quote_column(source.mssql_timestamp_column)
    piece_col = (
        _quote_column(source.mssql_piece_column) if source.mssql_piece_column else None
    )
    machine_col = (
        _quote_column(source.mssql_machine_column) if source.mssql_machine_column else None
    )

    since = _parse_watermark(watermark)
    if since is None:
        since = datetime.now() - timedelta(hours=source.mssql_lookback_hours)

    select_cols = [ts_col]
    if piece_col:
        select_cols.append(piece_col)
    if machine_col:
        select_cols.append(machine_col)

    query = (
        f"SELECT {', '.join(select_cols)} FROM {table} "
        f"WHERE {ts_col} > ? ORDER BY {ts_col}"
    )

    pieces: List[ParsedPiece] = []

    with _connect(source) as conn:
        cursor = conn.cursor()
        cursor.execute(query, since)
        col_names = []
        if piece_col:
            col_names.append(source.mssql_piece_column)
        if machine_col:
            col_names.append(source.mssql_machine_column)

        for row in cursor.fetchall():
            idx = 0
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

            pieces.append(
                ParsedPiece(
                    timestamp=timestamp,
                    nome_macchinario=nome_macchinario,
                    nome_pezzo=nome_pezzo,
                    raw_line=f"mssql:{source.mssql_table}:{timestamp.isoformat()}",
                )
            )

    if not pieces:
        if watermark is None:
            return [], datetime.now().isoformat(sep=" ")
        return [], watermark

    new_watermark = max(p.timestamp for p in pieces).isoformat(sep=" ")
    return pieces, new_watermark
