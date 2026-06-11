from __future__ import annotations

from typing import Literal, Optional

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
    department: Optional[str] = None
    line: Optional[str] = None
    status: MachineStatus
    ipAddress: str
    lastSeen: str
    interconnected: bool
    rdpUrl: Optional[str] = None
    imageUrl: Optional[str] = None


class AggregatorMachine(BaseModel):
    id: str
    smbHost: str
    connected: bool
    username: Optional[str] = None
    password: Optional[str] = None
    domain: Optional[str] = None
    nomeMacchinario: str
    nomePezzo: str


class MachineInput(BaseModel):
    name: str
    code: str
    type: str
    location: Optional[str] = ""
    department: str
    line: Optional[str] = None
    status: MachineStatus
    ipAddress: str
    interconnected: bool
    rdpUrl: Optional[str] = None
    imageUrl: Optional[str] = None


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
    durationMs: Optional[int] = None


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
    machineCode: Optional[str] = None
    machineName: Optional[str] = None
    ruleId: str
    ruleName: str
    severity: AlertSeverity
    status: AlertStatus
    message: str
    triggeredAt: str
    acknowledgedAt: Optional[str] = None
    acknowledgedBy: Optional[str] = None


class AlertAckInput(BaseModel):
    operator: str


class MaintenancePlan(BaseModel):
    id: str
    machineId: str
    machineCode: Optional[str] = None
    machineName: Optional[str] = None
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
    type: Optional[NoteType] = None
    scheduledAt: Optional[str] = None
    dueAt: Optional[str] = None
    status: Optional[MaintenanceStatus] = None
    assignee: Optional[str] = None
    description: Optional[str] = None


class ReliabilityMetricsBase(BaseModel):
    uptimePct: float
    downtimeMinutes: float
    mtbfHours: Optional[float] = None
    mttrMinutes: Optional[float] = None


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
    description: Optional[str] = None
    filterSnapshot: dict = Field(default_factory=dict)
    pivotConfig: dict = Field(default_factory=dict)
    defaultFormat: Literal["csv", "excel", "json", "pdf"]
    createdAt: str


class NewReportTemplateInput(BaseModel):
    name: str
    description: Optional[str] = None
    filterSnapshot: dict = Field(default_factory=dict)
    pivotConfig: dict = Field(default_factory=dict)
    defaultFormat: Literal["csv", "excel", "json", "pdf"] = "csv"


class ReportSchedule(BaseModel):
    id: str
    templateId: str
    templateName: Optional[str] = None
    cadence: ReportCadence
    recipients: str
    nextRun: str
    enabled: bool


class NewReportScheduleInput(BaseModel):
    templateId: str
    cadence: ReportCadence
    recipients: str
    enabled: bool = True
