from __future__ import annotations

from fastapi import APIRouter, HTTPException

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
from app.services import dashboard_data

router = APIRouter(tags=["dashboard"])


@router.get("/settings", response_model=AppSettings)
def get_settings() -> AppSettings:
    return dashboard_data.get_settings()


@router.put("/settings", response_model=AppSettings)
def update_settings(payload: AppSettings) -> AppSettings:
    return dashboard_data.update_settings(payload)


@router.get("/machines/{machine_id}/notes", response_model=list[MachineNote])
def list_notes(machine_id: str) -> list[MachineNote]:
    return dashboard_data.list_notes(machine_id)


@router.post("/machines/{machine_id}/notes", response_model=MachineNote, status_code=201)
def create_note(machine_id: str, payload: NewNoteInput) -> MachineNote:
    payload.machineId = machine_id
    return dashboard_data.create_note(payload)


@router.get("/alerts", response_model=list[Alert])
def list_alerts() -> list[Alert]:
    return dashboard_data.list_alerts()


@router.post("/alerts/{alert_id}/acknowledge", response_model=Alert)
def acknowledge_alert(alert_id: str, payload: AlertAckInput) -> Alert:
    alert = dashboard_data.acknowledge_alert(alert_id, payload)
    if not alert:
        raise HTTPException(status_code=404, detail="Allarme non trovato")
    return alert


@router.get("/maintenance", response_model=list[MaintenancePlan])
def list_maintenance() -> list[MaintenancePlan]:
    return dashboard_data.list_maintenance()


@router.post("/maintenance", response_model=MaintenancePlan, status_code=201)
def create_maintenance(payload: NewMaintenanceInput) -> MaintenancePlan:
    return dashboard_data.create_maintenance(payload)


@router.patch("/maintenance/{item_id}", response_model=MaintenancePlan)
def patch_maintenance(item_id: str, payload: MaintenancePatch) -> MaintenancePlan:
    item = dashboard_data.patch_maintenance(item_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Intervento non trovato")
    return item


@router.delete("/maintenance/{item_id}", status_code=204)
def delete_maintenance(item_id: str) -> None:
    if not dashboard_data.delete_maintenance(item_id):
        raise HTTPException(status_code=404, detail="Intervento non trovato")


@router.get("/audit", response_model=list[AuditEntry])
def list_audit() -> list[AuditEntry]:
    return dashboard_data.list_audit()


@router.post("/audit", response_model=AuditEntry, status_code=201)
def create_audit(payload: NewAuditInput) -> AuditEntry:
    return dashboard_data.create_audit(payload)


@router.get("/report-templates", response_model=list[ReportTemplate])
def list_report_templates() -> list[ReportTemplate]:
    return dashboard_data.list_report_templates()


@router.post("/report-templates", response_model=ReportTemplate, status_code=201)
def create_report_template(payload: NewReportTemplateInput) -> ReportTemplate:
    return dashboard_data.create_report_template(payload)


@router.delete("/report-templates/{template_id}", status_code=204)
def delete_report_template(template_id: str) -> None:
    if not dashboard_data.delete_report_template(template_id):
        raise HTTPException(status_code=404, detail="Template non trovato")


@router.get("/report-schedules", response_model=list[ReportSchedule])
def list_report_schedules() -> list[ReportSchedule]:
    return dashboard_data.list_report_schedules()


@router.post("/report-schedules", response_model=ReportSchedule, status_code=201)
def create_report_schedule(payload: NewReportScheduleInput) -> ReportSchedule:
    return dashboard_data.create_report_schedule(payload)


@router.delete("/report-schedules/{schedule_id}", status_code=204)
def delete_report_schedule(schedule_id: str) -> None:
    if not dashboard_data.delete_report_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedulazione non trovata")
