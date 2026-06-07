from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from app import db
from app.schemas import MachineStatus

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def machine_id_from_name(nome_macchinario: str) -> str:
    slug = _SLUG_RE.sub("-", nome_macchinario.lower()).strip("-")
    return f"m-{slug or uuid.uuid4().hex[:12]}"


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def iso(dt: datetime | None) -> str:
    if dt is None:
        return datetime.now(timezone.utc).isoformat()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def compute_status(
    last_seen: datetime | None,
    offline_threshold_min: int,
    override: str | None,
) -> MachineStatus:
    if override in ("online", "offline", "warning", "error"):
        return override  # type: ignore[return-value]
    if last_seen is None:
        return "offline"
    now = datetime.now(timezone.utc)
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    delta = now - last_seen
    if delta <= timedelta(minutes=offline_threshold_min):
        return "online"
    if delta <= timedelta(minutes=offline_threshold_min * 4):
        return "warning"
    return "offline"


def get_settings_row() -> dict:
    row = db.fetch_one("SELECT * FROM dashboard_settings WHERE id = 1")
    if row:
        return row
    db.execute(
        """
        INSERT INTO dashboard_settings (id)
        VALUES (1)
        ON CONFLICT (id) DO NOTHING
        """
    )
    return db.fetch_one("SELECT * FROM dashboard_settings WHERE id = 1") or {}


def offline_threshold_min() -> int:
    return int(get_settings_row().get("offline_threshold_min") or 15)
