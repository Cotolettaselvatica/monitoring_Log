from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MachineStatus = Literal["online", "offline", "warning", "error"]
LogLevel = Literal["info", "warning", "error"]
NoteType = Literal["ordinaria", "straordinaria"]
AlertSeverity = Literal["info", "warning", "critical"]
AlertStatus = Literal["active", "acknowledged", "resolved"]
MaintenanceStatus = Literal["pianificata", "in_corso", "completata", "scaduta"]
ReportCadence = Literal["daily", "weekly", "monthly"]
ThemeMode = Literal["light", "dark"]


class Machine(BaseModel):
    id: str
    name: str
    code: str
    type: str
    location: str
    department: str | None = None
    line: str | None = None
    status: MachineStatus
    ipAddress: str
    lastSeen: str
    interconnected: bool
    rdpUrl: str | None = None
    imageUrl: str | None = None


class MachineInput(BaseModel):
    name: str
    code: str
    type: str
    location: str | None = ""
    department: str
    line: str | None = None
    status: MachineStatus
    ipAddress: str
    interconnected: bool
    rdpUrl: str | None = None
    imageUrl: str | None = None


class MachineStatusPatch(BaseModel):
    status: MachineStatus


class LogEntry(BaseModel):
    id: str
    machineId: str
    timestamp: str
    action: str
    level: LogLevel
    message: str
    user: str
    durationMs: int | None = None


class MachineNote(BaseModel):
    id: str
    machineId: str
    timestamp: str
    type: NoteType
    author: str
    text: str


class NewNoteInput(BaseModel):
    machineId: str
    type: NoteType
    author: str
    text: str


class Alert(BaseModel):
    id: str
    machineId: str
    machineCode: str | None = None
    machineName: str | None = None
    ruleId: str
    ruleName: str
    severity: AlertSeverity
    status: AlertStatus
    message: str
    triggeredAt: str
    acknowledgedAt: str | None = None
    acknowledgedBy: str | None = None


class AlertAckInput(BaseModel):
    operator: str


class MaintenancePlan(BaseModel):
    id: str
    machineId: str
    machineCode: str | None = None
    machineName: str | None = None
    type: NoteType
    scheduledAt: str
    dueAt: str
    status: MaintenanceStatus
    assignee: str
    description: str


class NewMaintenanceInput(BaseModel):
    machineId: str
    type: NoteType
    scheduledAt: str
    dueAt: str
    assignee: str
    description: str


class MaintenancePatch(BaseModel):
    type: NoteType | None = None
    scheduledAt: str | None = None
    dueAt: str | None = None
    status: MaintenanceStatus | None = None
    assignee: str | None = None
    description: str | None = None


class ReliabilityMetricsBase(BaseModel):
    uptimePct: float
    downtimeMinutes: float
    mtbfHours: float | None = None
    mttrMinutes: float | None = None


class MachineMetrics(ReliabilityMetricsBase):
    machineId: str
    periodLabel: str
    failures: int


class FleetMetrics(ReliabilityMetricsBase):
    periodLabel: str
    failures: int
    machinesOnline: int
    machinesTotal: int


class ChartSeriesPoint(BaseModel):
    key: str
    count: int


class AuditEntry(BaseModel):
    id: str
    timestamp: str
    operator: str
    action: str
    entityType: str
    entityId: str
    details: str


class NewAuditInput(BaseModel):
    operator: str
    action: str
    entityType: str
    entityId: str
    details: str = ""


class AppSettings(BaseModel):
    rdpGatewayUrl: str
    pollingIntervalSec: int
    offlineThresholdMin: int
    errorThresholdPerHour: int
    themeMode: ThemeMode


class ReportTemplate(BaseModel):
    id: str
    name: str
    description: str | None = None
    filterSnapshot: dict = Field(default_factory=dict)
    pivotConfig: dict = Field(default_factory=dict)
    defaultFormat: Literal["csv", "excel", "json", "pdf"]
    createdAt: str


class NewReportTemplateInput(BaseModel):
    name: str
    description: str | None = None
    filterSnapshot: dict = Field(default_factory=dict)
    pivotConfig: dict = Field(default_factory=dict)
    defaultFormat: Literal["csv", "excel", "json", "pdf"] = "csv"


class ReportSchedule(BaseModel):
    id: str
    templateId: str
    templateName: str | None = None
    cadence: ReportCadence
    recipients: str
    nextRun: str
    enabled: bool


class NewReportScheduleInput(BaseModel):
    templateId: str
    cadence: ReportCadence
    recipients: str
    enabled: bool = True
