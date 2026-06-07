from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Generator, Iterable

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

from app.config import Settings, load_settings

_pool: pool.SimpleConnectionPool | None = None


def init_pool(settings: Settings | None = None) -> None:
    global _pool
    cfg = settings or load_settings()
    if _pool is not None:
        return
    _pool = pool.SimpleConnectionPool(
        minconn=1,
        maxconn=10,
        host=cfg.db_host,
        port=cfg.db_port,
        dbname=cfg.db_name,
        user=cfg.db_user,
        password=cfg.db_password,
        connect_timeout=10,
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def get_conn() -> Generator[Any, None, None]:
    if _pool is None:
        init_pool()
    assert _pool is not None
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


@contextmanager
def get_cursor() -> Generator[Any, None, None]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
            conn.commit()


def fetch_all(query: str, params: Iterable[Any] | None = None) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(query, params)
        return list(cur.fetchall())


def fetch_one(query: str, params: Iterable[Any] | None = None) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute(query: str, params: Iterable[Any] | None = None) -> None:
    with get_cursor() as cur:
        cur.execute(query, params)


def execute_returning(query: str, params: Iterable[Any] | None = None) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
        return dict(row) if row else None
