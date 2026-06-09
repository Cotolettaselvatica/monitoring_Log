from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse

from dotenv import load_dotenv


@dataclass(frozen=True)
class DbConn:
    host: str
    port: int
    name: str
    user: str
    password: str


@dataclass(frozen=True)
class Settings:
    source: DbConn
    supabase_url: str
    sync_interval_sec: int
    sync_batch_size: int


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Variabile d'ambiente obbligatoria mancante: {name}")
    return value


def _conn_from_env(prefix: str) -> DbConn:
    return DbConn(
        host=os.getenv(f"{prefix}_HOST", "localhost"),
        port=int(os.getenv(f"{prefix}_PORT", "5432")),
        name=_require(f"{prefix}_NAME"),
        user=_require(f"{prefix}_USER"),
        password=_require(f"{prefix}_PASSWORD"),
    )


def load_settings(env_file: str | None = None) -> Settings:
    if env_file:
        load_dotenv(env_file, override=False)
    else:
        load_dotenv(os.getenv("SYNC_SUPABASE_ENV", "/etc/sync-supabase.env"), override=False)
        load_dotenv(override=False)

    supabase_url = _require("SUPABASE_DATABASE_URL")
    parsed = urlparse(supabase_url)
    if parsed.scheme not in ("postgresql", "postgres"):
        raise ValueError("SUPABASE_DATABASE_URL deve iniziare con postgresql://")

    return Settings(
        source=_conn_from_env("SOURCE_DB"),
        supabase_url=supabase_url,
        sync_interval_sec=int(os.getenv("SYNC_INTERVAL_SEC", "30")),
        sync_batch_size=int(os.getenv("SYNC_BATCH_SIZE", "500")),
    )
