export type MachineStatus = "online" | "offline" | "warning" | "error";
export type LogLevel = "info" | "warning" | "error";
export type NoteType = "ordinaria" | "straordinaria";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type MaintenanceStatus = "pianificata" | "in_corso" | "completata" | "scaduta";
export type ReportCadence = "daily" | "weekly" | "monthly";
export type ThemeMode = "light" | "dark";

export interface Machine {
  id: string;
  name: string;
  code: string;
  type: string;
  location: string;
  department?: string;
  line?: string;
  status: MachineStatus;
  ipAddress: string;
  lastSeen: string;
  interconnected: boolean;
  rdpUrl?: string;
  imageUrl?: string;
}

/** Macchina Windows da WIN_log_aggregator (config YAML). */
export interface AggregatorMachine {
  id: string;
  smbHost: string;
  connected: boolean;
  username?: string | null;
  password?: string | null;
  domain?: string | null;
  nomeMacchinario: string;
  nomePezzo: string;
}

export interface MachineInput {
  name: string;
  code: string;
  type: string;
  location?: string;
  department: string;
  line?: string;
  status: MachineStatus;
  ipAddress: string;
  interconnected: boolean;
  rdpUrl?: string;
  imageUrl?: string;
}

export interface LogEntry {
  id: string;
  machineId: string;
  timestamp: string;
  action: string;
  level: LogLevel;
  message: string;
  user: string;
  durationMs?: number;
}

export interface MachineNote {
  id: string;
  machineId: string;
  timestamp: string;
  type: NoteType;
  author: string;
  text: string;
}

export interface LogRow extends LogEntry {
  machineName: string;
  machineCode: string;
  machineLocation: string;
  machineImageUrl?: string;
}

export interface Alert {
  id: string;
  machineId: string;
  machineCode?: string;
  machineName?: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: AlertSeverity;
  enabled: boolean;
}

export interface MaintenancePlan {
  id: string;
  machineId: string;
  machineCode?: string;
  machineName?: string;
  type: NoteType;
  scheduledAt: string;
  dueAt: string;
  status: MaintenanceStatus;
  assignee: string;
  description: string;
}

/** Campi condivisi tra metriche flotta e macchinario (uptime, MTBF, MTTR). */
export interface ReliabilityMetricsBase {
  uptimePct: number;
  downtimeMinutes: number;
  /** null = dato non ancora fornito dall'API */
  mtbfHours: number | null;
  mttrMinutes: number | null;
}

export interface MachineMetrics extends ReliabilityMetricsBase {
  machineId: string;
  periodLabel: string;
  failures: number;
}

export interface FleetMetrics extends ReliabilityMetricsBase {
  periodLabel: string;
  failures: number;
  machinesOnline: number;
  machinesTotal: number;
}

export type ChartPeriod = "hour" | "day" | "week" | "month" | "year";

export interface ChartSeriesPoint {
  key: string;
  count: number;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export interface AppSettings {
  rdpGatewayUrl: string;
  pollingIntervalSec: number;
  offlineThresholdMin: number;
  errorThresholdPerHour: number;
  themeMode: ThemeMode;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  filterSnapshot: Record<string, unknown>;
  pivotConfig: Record<string, unknown>;
  defaultFormat: "csv" | "excel" | "json" | "pdf";
  createdAt: string;
}

export interface ReportSchedule {
  id: string;
  templateId: string;
  templateName?: string;
  cadence: ReportCadence;
  recipients: string;
  nextRun: string;
  enabled: boolean;
}

export interface NewMaintenanceInput {
  machineId: string;
  type: NoteType;
  scheduledAt: string;
  dueAt: string;
  assignee: string;
  description: string;
}

export interface NewReportTemplateInput {
  name: string;
  description?: string;
  filterSnapshot: Record<string, unknown>;
  pivotConfig: Record<string, unknown>;
  defaultFormat: ReportTemplate["defaultFormat"];
}

export interface NewReportScheduleInput {
  templateId: string;
  cadence: ReportCadence;
  recipients: string;
  enabled: boolean;
}
