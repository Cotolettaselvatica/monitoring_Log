from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, Sequence

from sync_supabase import db
from sync_supabase.config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TableSync:
    name: str
    columns: Sequence[str]
    pk: str
    sync_fn: Callable[..., int]


CONTEGGI_COLUMNS = ("id", "nome_macchinario", "nome_pezzo", "timestamp")

MACCHINARI_COLUMNS = (
    "id",
    "nome_macchinario",
    "name",
    "code",
    "type",
    "location",
    "department",
    "line",
    "status_override",
    "ip_address",
    "interconnected",
    "rdp_url",
    "image_url",
    "created_at",
    "updated_at",
)

SETTINGS_COLUMNS = (
    "id",
    "rdp_gateway_url",
    "polling_interval_sec",
    "offline_threshold_min",
    "error_threshold_per_hour",
    "theme_mode",
)

NOTES_COLUMNS = ("id", "machine_id", "timestamp", "type", "author", "text")

ALERTS_COLUMNS = (
    "id",
    "machine_id",
    "rule_id",
    "rule_name",
    "severity",
    "status",
    "message",
    "triggered_at",
    "acknowledged_at",
    "acknowledged_by",
)

MAINTENANCE_COLUMNS = (
    "id",
    "machine_id",
    "type",
    "scheduled_at",
    "due_at",
    "status",
    "assignee",
    "description",
)

AUDIT_COLUMNS = ("id", "timestamp", "operator", "action", "entity_type", "entity_id", "details")

TEMPLATES_COLUMNS = (
    "id",
    "name",
    "description",
    "filter_snapshot",
    "pivot_config",
    "default_format",
    "created_at",
)

SCHEDULES_COLUMNS = ("id", "template_id", "cadence", "recipients", "next_run", "enabled")

# Ordine rispetta le foreign key su Supabase.
FULL_SYNC_TABLES: list[tuple[str, Sequence[str], str]] = [
    ("dashboard_macchinari", MACCHINARI_COLUMNS, "id"),
    ("dashboard_settings", SETTINGS_COLUMNS, "id"),
    ("dashboard_report_templates", TEMPLATES_COLUMNS, "id"),
    ("dashboard_notes", NOTES_COLUMNS, "id"),
    ("dashboard_alerts", ALERTS_COLUMNS, "id"),
    ("dashboard_maintenance", MAINTENANCE_COLUMNS, "id"),
    ("dashboard_audit", AUDIT_COLUMNS, "id"),
    ("dashboard_report_schedules", SCHEDULES_COLUMNS, "id"),
]


def _row_tuple(row: dict[str, Any], columns: Sequence[str]) -> tuple[Any, ...]:
    return tuple(row.get(c) for c in columns)


def sync_conteggi_pezzi(
    source_cur: Any,
    target_cur: Any,
    batch_size: int,
) -> int:
    db.ensure_source_state_table(source_cur)
    last_id = db.get_last_bigint(source_cur, "conteggi_pezzi")

    source_cur.execute(
        """
        SELECT id, nome_macchinario, nome_pezzo, timestamp
        FROM conteggi_pezzi
        WHERE id > %s
        ORDER BY id
        LIMIT %s
        """,
        (last_id, batch_size),
    )
    rows = [dict(r) for r in source_cur.fetchall()]
    if not rows:
        return 0

    tuples = [_row_tuple(r, CONTEGGI_COLUMNS) for r in rows]
    db.upsert_rows_values(
        target_cur,
        "conteggi_pezzi",
        CONTEGGI_COLUMNS,
        tuples,
        "id",
    )

    new_last = max(int(r["id"]) for r in rows)
    db.set_last_bigint(source_cur, "conteggi_pezzi", new_last)

    target_cur.execute(
        "SELECT setval(pg_get_serial_sequence('conteggi_pezzi', 'id'), GREATEST((SELECT MAX(id) FROM conteggi_pezzi), 1))"
    )
    return len(rows)


def sync_full_table(
    source_cur: Any,
    target_cur: Any,
    table: str,
    columns: Sequence[str],
    pk: str,
) -> int:
    cols_sql = ", ".join(columns)
    source_cur.execute(f"SELECT {cols_sql} FROM {table}")
    rows = [dict(r) for r in source_cur.fetchall()]
    if not rows:
        db.bump_sync_timestamp(source_cur, table)
        return 0

    db.upsert_rows(target_cur, table, columns, rows, pk)
    db.bump_sync_timestamp(source_cur, table)
    return len(rows)


def run_sync_cycle(settings: Settings, source_conn: Any, target_conn: Any) -> dict[str, int]:
    stats: dict[str, int] = {}

    with db.source_cursor(source_conn) as source_cur:
        with db.target_cursor(target_conn) as target_cur:
            db.ensure_source_state_table(source_cur)

            count = sync_conteggi_pezzi(source_cur, target_cur, settings.sync_batch_size)
            stats["conteggi_pezzi"] = count

            for table, columns, pk in FULL_SYNC_TABLES:
                count = sync_full_table(source_cur, target_cur, table, columns, pk)
                stats[table] = count

            source_conn.commit()
            target_conn.commit()

    return stats


def run_once(settings: Settings) -> dict[str, int]:
    source_conn = db.connect_source(settings.source)
    target_conn = db.connect_supabase(settings.supabase_url)
    try:
        stats = run_sync_cycle(settings, source_conn, target_conn)
        moved = sum(stats.values())
        if moved:
            logger.info("Sync completato: %s", stats)
        else:
            logger.debug("Sync completato, nessuna modifica")
        return stats
    except Exception:
        source_conn.rollback()
        target_conn.rollback()
        raise
    finally:
        source_conn.close()
        target_conn.close()
