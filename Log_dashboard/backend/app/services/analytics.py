from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.schemas import ChartSeriesPoint, FleetMetrics, MachineMetrics
from app.services.aggregator_machines import list_aggregator_machines
from app.services.machines import get_machine, get_nome_macchinario, list_machines
from app.services.pieces import activity_stats, bucket_counts, production_since


def _period_label(days: int) -> str:
    return f"Ultimi {days} giorni"


def _bucket_key(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _fill_buckets(
    rows: list[dict],
    unit: str,
    count: int,
) -> list[ChartSeriesPoint]:
    now = datetime.now(timezone.utc)
    if unit == "hour":
        start = now - timedelta(hours=count - 1)
        delta = timedelta(hours=1)
        trunc = lambda d: d.replace(minute=0, second=0, microsecond=0)
    elif unit == "day":
        start = (now - timedelta(days=count - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
        delta = timedelta(days=1)
        trunc = lambda d: d.replace(hour=0, minute=0, second=0, microsecond=0)
    elif unit == "week":
        start = now - timedelta(weeks=count - 1)
        delta = timedelta(weeks=1)
        trunc = lambda d: (d - timedelta(days=d.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif unit == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(days=30 * (count - 1))
        delta = timedelta(days=30)
        trunc = lambda d: d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(days=365 * (count - 1))
        delta = timedelta(days=365)
        trunc = lambda d: d.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    counts: dict[str, int] = {}
    cursor = trunc(start)
    end = trunc(now)
    while cursor <= end:
        counts[_bucket_key(cursor)] = 0
        cursor += delta

    for row in rows:
        bucket = row["bucket"]
        if bucket.tzinfo is None:
            bucket = bucket.replace(tzinfo=timezone.utc)
        key = _bucket_key(trunc(bucket))
        if key in counts:
            counts[key] = int(row["count"])

    return [ChartSeriesPoint(key=k, count=v) for k, v in counts.items()]


def chart_series(
    period: str,
    machine_id: str | None = None,
) -> list[ChartSeriesPoint]:
    machine_nome = None
    if machine_id:
        machine_nome = get_nome_macchinario(machine_id)

    config = {
        "hourly": ("hour", 24, timedelta(hours=24)),
        "daily": ("day", 7, timedelta(days=7)),
        "weekly": ("week", 8, timedelta(weeks=8)),
        "monthly": ("month", 12, timedelta(days=365)),
        "yearly": ("year", 5, timedelta(days=365 * 5)),
    }
    unit, bucket_count, since_delta = config[period]
    since = datetime.now(timezone.utc) - since_delta
    trunc_unit = {"hourly": "hour", "daily": "day", "weekly": "week", "monthly": "month", "yearly": "year"}[period]
    rows = bucket_counts(trunc_unit, since, machine_nome)
    return _fill_buckets(rows, unit, bucket_count)


def fleet_metrics(period_days: int = 7) -> FleetMetrics:
    since = datetime.now(timezone.utc) - timedelta(days=period_days)
    machines = list_machines()
    try:
        aggregator_machines = list_aggregator_machines()
    except (FileNotFoundError, OSError):
        aggregator_machines = []
    online = sum(1 for m in machines if m.status == "online")
    online += sum(1 for m in aggregator_machines if m.connected)
    total = len(machines) + len(aggregator_machines)
    total_events = activity_stats(since)["event_count"] or 0
    total_minutes = period_days * 24 * 60
    active_minutes = min(total_minutes, int(total_events) * 2)
    uptime = round((active_minutes / total_minutes) * 100, 1) if total_minutes else 0.0

    return FleetMetrics(
        periodLabel=_period_label(period_days),
        uptimePct=uptime,
        downtimeMinutes=round(total_minutes - active_minutes, 1),
        mtbfHours=None,
        mttrMinutes=None,
        failures=0,
        machinesOnline=online,
        machinesTotal=total,
    )


def machine_metrics(machine_id: str, period_days: int = 7) -> MachineMetrics | None:
    machine = get_machine(machine_id)
    if not machine:
        return None
    since = datetime.now(timezone.utc) - timedelta(days=period_days)
    nome = get_nome_macchinario(machine_id)
    stats = activity_stats(since, nome)
    events = int(stats.get("event_count") or 0)
    total_minutes = period_days * 24 * 60
    active_minutes = min(total_minutes, events * 2)
    uptime = round((active_minutes / total_minutes) * 100, 1) if total_minutes else 0.0

    return MachineMetrics(
        machineId=machine_id,
        periodLabel=_period_label(period_days),
        uptimePct=uptime,
        downtimeMinutes=round(total_minutes - active_minutes, 1),
        mtbfHours=None,
        mttrMinutes=None,
        failures=0,
    )
