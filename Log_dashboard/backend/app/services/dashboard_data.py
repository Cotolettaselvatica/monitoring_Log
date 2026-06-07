from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from app import db
from app.schemas import (
    Alert,
    AlertAckInput,
    AppSettings,
    AuditEntry,
    MaintenancePlan,
    MaintenancePatch,
    MachineNote,
    NewAuditInput,
    NewMaintenanceInput,
    NewNoteInput,
    NewReportScheduleInput,
    NewReportTemplateInput,
    ReportSchedule,
    ReportTemplate,
)
from app.services.machines import get_machine, list_machines
from app.services.utils import get_settings_row, iso, new_id


def get_settings() -> AppSettings:
    row = get_settings_row()
    return AppSettings(
        rdpGatewayUrl=row.get("rdp_gateway_url") or "",
        pollingIntervalSec=int(row.get("polling_interval_sec") or 30),
        offlineThresholdMin=int(row.get("offline_threshold_min") or 15),
        errorThresholdPerHour=int(row.get("error_threshold_per_hour") or 5),
        themeMode=row.get("theme_mode") or "light",
    )


def update_settings(settings: AppSettings) -> AppSettings:
    db.execute(
        """
        UPDATE dashboard_settings SET
            rdp_gateway_url = %s,
            polling_interval_sec = %s,
            offline_threshold_min = %s,
            error_threshold_per_hour = %s,
            theme_mode = %s
        WHERE id = 1
        """,
        (
            settings.rdpGatewayUrl,
            settings.pollingIntervalSec,
            settings.offlineThresholdMin,
            settings.errorThresholdPerHour,
            settings.themeMode,
        ),
    )
    return get_settings()


def list_notes(machine_id: str) -> list[MachineNote]:
    rows = db.fetch_all(
        """
        SELECT * FROM dashboard_notes
        WHERE machine_id = %s
        ORDER BY timestamp DESC
        """,
        (machine_id,),
    )
    return [
        MachineNote(
            id=row["id"],
            machineId=row["machine_id"],
            timestamp=iso(row["timestamp"]),
            type=row["type"],
            author=row["author"],
            text=row["text"],
        )
        for row in rows
    ]


def create_note(input_data: NewNoteInput) -> MachineNote:
    note_id = new_id("n")
    row = db.execute_returning(
        """
        INSERT INTO dashboard_notes (id, machine_id, type, author, text)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (note_id, input_data.machineId, input_data.type, input_data.author, input_data.text),
    )
    assert row
    return MachineNote(
        id=row["id"],
        machineId=row["machine_id"],
        timestamp=iso(row["timestamp"]),
        type=row["type"],
        author=row["author"],
        text=row["text"],
    )


def _alert_from_row(row: dict) -> Alert:
    machine = get_machine(row["machine_id"])
    return Alert(
        id=row["id"],
        machineId=row["machine_id"],
        machineCode=machine.code if machine else None,
        machineName=machine.name if machine else None,
        ruleId=row["rule_id"],
        ruleName=row["rule_name"],
        severity=row["severity"],
        status=row["status"],
        message=row["message"],
        triggeredAt=iso(row["triggered_at"]),
        acknowledgedAt=iso(row["acknowledged_at"]) if row.get("acknowledged_at") else None,
        acknowledgedBy=row.get("acknowledged_by"),
    )


def list_alerts() -> list[Alert]:
    rows = db.fetch_all(
        "SELECT * FROM dashboard_alerts ORDER BY triggered_at DESC LIMIT 200"
    )
    generated = _generate_alerts_from_machines()
    stored = [_alert_from_row(row) for row in rows]
    seen = {a.id for a in stored}
    for alert in generated:
        if alert.id not in seen:
            stored.append(alert)
    return sorted(stored, key=lambda a: a.triggeredAt, reverse=True)


def _generate_alerts_from_machines() -> list[Alert]:
    alerts: list[Alert] = []
    for machine in list_machines():
        if machine.status in ("offline", "warning", "error"):
            alerts.append(
                Alert(
                    id=f"auto-{machine.id}",
                    machineId=machine.id,
                    machineCode=machine.code,
                    machineName=machine.name,
                    ruleId="r1" if machine.status == "offline" else "r2",
                    ruleName="Macchinario offline" if machine.status == "offline" else "Attività anomala",
                    severity="critical" if machine.status in ("offline", "error") else "warning",
                    status="active",
                    message=f"Allarme su {machine.code}: stato {machine.status}",
                    triggeredAt=machine.lastSeen,
                )
            )
    return alerts


def acknowledge_alert(alert_id: str, payload: AlertAckInput) -> Alert | None:
    if alert_id.startswith("auto-"):
        machine_id = alert_id.removeprefix("auto-")
        alert = Alert(
            id=alert_id,
            machineId=machine_id,
            ruleId="r1",
            ruleName="Macchinario offline",
            severity="warning",
            status="acknowledged",
            message="Allarme confermato",
            triggeredAt=datetime.now(timezone.utc).isoformat(),
            acknowledgedAt=datetime.now(timezone.utc).isoformat(),
            acknowledgedBy=payload.operator,
        )
        return alert

    row = db.execute_returning(
        """
        UPDATE dashboard_alerts
        SET status = 'acknowledged',
            acknowledged_at = NOW(),
            acknowledged_by = %s
        WHERE id = %s
        RETURNING *
        """,
        (payload.operator, alert_id),
    )
    return _alert_from_row(row) if row else None


def _maintenance_from_row(row: dict) -> MaintenancePlan:
    machine = get_machine(row["machine_id"])
    return MaintenancePlan(
        id=row["id"],
        machineId=row["machine_id"],
        machineCode=machine.code if machine else None,
        machineName=machine.name if machine else None,
        type=row["type"],
        scheduledAt=iso(row["scheduled_at"]),
        dueAt=iso(row["due_at"]),
        status=row["status"],
        assignee=row["assignee"],
        description=row["description"],
    )


def list_maintenance() -> list[MaintenancePlan]:
    rows = db.fetch_all("SELECT * FROM dashboard_maintenance ORDER BY due_at")
    return [_maintenance_from_row(row) for row in rows]


def create_maintenance(input_data: NewMaintenanceInput) -> MaintenancePlan:
    item_id = new_id("mp")
    row = db.execute_returning(
        """
        INSERT INTO dashboard_maintenance (
            id, machine_id, type, scheduled_at, due_at, assignee, description
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            item_id,
            input_data.machineId,
            input_data.type,
            input_data.scheduledAt,
            input_data.dueAt,
            input_data.assignee,
            input_data.description,
        ),
    )
    assert row
    return _maintenance_from_row(row)


def patch_maintenance(item_id: str, patch: MaintenancePatch) -> MaintenancePlan | None:
    current = db.fetch_one("SELECT * FROM dashboard_maintenance WHERE id = %s", (item_id,))
    if not current:
        return None
    row = db.execute_returning(
        """
        UPDATE dashboard_maintenance SET
            type = COALESCE(%s, type),
            scheduled_at = COALESCE(%s, scheduled_at),
            due_at = COALESCE(%s, due_at),
            status = COALESCE(%s, status),
            assignee = COALESCE(%s, assignee),
            description = COALESCE(%s, description)
        WHERE id = %s
        RETURNING *
        """,
        (
            patch.type,
            patch.scheduledAt,
            patch.dueAt,
            patch.status,
            patch.assignee,
            patch.description,
            item_id,
        ),
    )
    return _maintenance_from_row(row) if row else None


def delete_maintenance(item_id: str) -> bool:
    row = db.execute_returning(
        "DELETE FROM dashboard_maintenance WHERE id = %s RETURNING id",
        (item_id,),
    )
    return row is not None


def list_audit() -> list[AuditEntry]:
    rows = db.fetch_all("SELECT * FROM dashboard_audit ORDER BY timestamp DESC LIMIT 500")
    return [
        AuditEntry(
            id=row["id"],
            timestamp=iso(row["timestamp"]),
            operator=row["operator"],
            action=row["action"],
            entityType=row["entity_type"],
            entityId=row["entity_id"],
            details=row["details"] or "",
        )
        for row in rows
    ]


def create_audit(input_data: NewAuditInput) -> AuditEntry:
    entry_id = new_id("audit")
    row = db.execute_returning(
        """
        INSERT INTO dashboard_audit (id, operator, action, entity_type, entity_id, details)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            entry_id,
            input_data.operator,
            input_data.action,
            input_data.entityType,
            input_data.entityId,
            input_data.details,
        ),
    )
    assert row
    return AuditEntry(
        id=row["id"],
        timestamp=iso(row["timestamp"]),
        operator=row["operator"],
        action=row["action"],
        entityType=row["entity_type"],
        entityId=row["entity_id"],
        details=row["details"] or "",
    )


def list_report_templates() -> list[ReportTemplate]:
    rows = db.fetch_all("SELECT * FROM dashboard_report_templates ORDER BY created_at DESC")
    return [_template_from_row(row) for row in rows]


def _template_from_row(row: dict) -> ReportTemplate:
    return ReportTemplate(
        id=row["id"],
        name=row["name"],
        description=row.get("description"),
        filterSnapshot=row.get("filter_snapshot") or {},
        pivotConfig=row.get("pivot_config") or {},
        defaultFormat=row["default_format"],
        createdAt=iso(row["created_at"]),
    )


def create_report_template(input_data: NewReportTemplateInput) -> ReportTemplate:
    template_id = new_id("rt")
    row = db.execute_returning(
        """
        INSERT INTO dashboard_report_templates (
            id, name, description, filter_snapshot, pivot_config, default_format
        ) VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s)
        RETURNING *
        """,
        (
            template_id,
            input_data.name,
            input_data.description,
            json.dumps(input_data.filterSnapshot),
            json.dumps(input_data.pivotConfig),
            input_data.defaultFormat,
        ),
    )
    assert row
    return _template_from_row(row)


def delete_report_template(template_id: str) -> bool:
    row = db.execute_returning(
        "DELETE FROM dashboard_report_templates WHERE id = %s RETURNING id",
        (template_id,),
    )
    return row is not None


def list_report_schedules() -> list[ReportSchedule]:
    rows = db.fetch_all(
        """
        SELECT s.*, t.name AS template_name
        FROM dashboard_report_schedules s
        JOIN dashboard_report_templates t ON t.id = s.template_id
        ORDER BY s.next_run
        """
    )
    return [
        ReportSchedule(
            id=row["id"],
            templateId=row["template_id"],
            templateName=row.get("template_name"),
            cadence=row["cadence"],
            recipients=row["recipients"],
            nextRun=iso(row["next_run"]),
            enabled=bool(row["enabled"]),
        )
        for row in rows
    ]


def create_report_schedule(input_data: NewReportScheduleInput) -> ReportSchedule:
    schedule_id = new_id("rs")
    next_run = datetime.now(timezone.utc) + timedelta(days=1)
    row = db.execute_returning(
        """
        INSERT INTO dashboard_report_schedules (id, template_id, cadence, recipients, next_run, enabled)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            schedule_id,
            input_data.templateId,
            input_data.cadence,
            input_data.recipients,
            next_run,
            input_data.enabled,
        ),
    )
    assert row
    template = db.fetch_one(
        "SELECT name FROM dashboard_report_templates WHERE id = %s",
        (input_data.templateId,),
    )
    return ReportSchedule(
        id=row["id"],
        templateId=row["template_id"],
        templateName=template["name"] if template else None,
        cadence=row["cadence"],
        recipients=row["recipients"],
        nextRun=iso(row["next_run"]),
        enabled=bool(row["enabled"]),
    )


def delete_report_schedule(schedule_id: str) -> bool:
    row = db.execute_returning(
        "DELETE FROM dashboard_report_schedules WHERE id = %s RETURNING id",
        (schedule_id,),
    )
    return row is not None
