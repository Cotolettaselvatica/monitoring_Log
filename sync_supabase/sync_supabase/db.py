from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Generator, Iterable, Sequence

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from sync_supabase.config import DbConn, Settings

logger = logging.getLogger(__name__)


def connect_source(settings: DbConn) -> psycopg2.extensions.connection:
    conn = psycopg2.connect(
        host=settings.host,
        port=settings.port,
        dbname=settings.name,
        user=settings.user,
        password=settings.password,
        connect_timeout=15,
    )
    conn.autocommit = False
    return conn


def connect_supabase(database_url: str) -> psycopg2.extensions.connection:
    conn = psycopg2.connect(database_url, connect_timeout=15)
    conn.autocommit = False
    return conn


@contextmanager
def source_cursor(conn: psycopg2.extensions.connection) -> Generator[Any, None, None]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        yield cur


@contextmanager
def target_cursor(conn: psycopg2.extensions.connection) -> Generator[Any, None, None]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        yield cur


def fetch_all(cur: Any, query: str, params: Iterable[Any] | None = None) -> list[dict[str, Any]]:
    cur.execute(query, params)
    return [dict(row) for row in cur.fetchall()]


def upsert_rows(
    cur: Any,
    table: str,
    columns: Sequence[str],
    rows: list[dict[str, Any]],
    conflict_column: str,
) -> int:
    if not rows:
        return 0

    cols_sql = ", ".join(columns)
    placeholders = ", ".join(f"%({c})s" for c in columns)
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in columns if c != conflict_column)

    query = f"""
        INSERT INTO {table} ({cols_sql})
        VALUES ({placeholders})
        ON CONFLICT ({conflict_column}) DO UPDATE SET {updates}
    """
    for row in rows:
        cur.execute(query, row)
    return len(rows)


def upsert_rows_values(
    cur: Any,
    table: str,
    columns: Sequence[str],
    rows: list[tuple[Any, ...]],
    conflict_column: str,
) -> int:
    if not rows:
        return 0

    cols_sql = ", ".join(columns)
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in columns if c != conflict_column)
    query = f"""
        INSERT INTO {table} ({cols_sql})
        VALUES %s
        ON CONFLICT ({conflict_column}) DO UPDATE SET {updates}
    """
    execute_values(cur, query, rows, page_size=100)
    return len(rows)


def ensure_source_state_table(cur: Any) -> None:
    """Richiede che setup-source.sh sia stato eseguito sul DB sorgente."""
    cur.execute(
        """
        INSERT INTO sync_supabase_state (table_name, last_bigint)
        VALUES ('conteggi_pezzi', 0)
        ON CONFLICT (table_name) DO NOTHING
        """
    )


def get_last_bigint(cur: Any, table_name: str) -> int:
    cur.execute(
        "SELECT last_bigint FROM sync_supabase_state WHERE table_name = %s",
        (table_name,),
    )
    row = cur.fetchone()
    return int(row["last_bigint"]) if row else 0


def set_last_bigint(cur: Any, table_name: str, last_bigint: int) -> None:
    cur.execute(
        """
        INSERT INTO sync_supabase_state (table_name, last_bigint, last_synced_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (table_name) DO UPDATE
        SET last_bigint = EXCLUDED.last_bigint,
            last_synced_at = NOW()
        """,
        (table_name, last_bigint),
    )


def bump_sync_timestamp(cur: Any, table_name: str) -> None:
    cur.execute(
        """
        INSERT INTO sync_supabase_state (table_name, last_bigint, last_synced_at)
        VALUES (%s, 0, NOW())
        ON CONFLICT (table_name) DO UPDATE
        SET last_synced_at = NOW()
        """,
        (table_name,),
    )
