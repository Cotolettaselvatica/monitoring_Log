import dayjs, { type Dayjs } from "dayjs";
import type {
  LogRow,
  LogLevel,
  Machine,
  MachineStatus,
  Alert,
  AlertSeverity,
  AlertStatus,
  MaintenancePlan,
  MaintenanceStatus,
  AuditEntry,
} from "@/types";

export interface PageFilterState {
  dateFrom: Dayjs | null;
  dateTo: Dayjs | null;
  machineId: string;
  department: string;
  line: string;
  status: MachineStatus | "";
  level: LogLevel | "";
  action: string;
  severity: AlertSeverity | "";
  alertStatus: AlertStatus | "";
  maintenanceStatus: MaintenanceStatus | "";
  search: string;
}

export const defaultPageFilters: PageFilterState = {
  dateFrom: null,
  dateTo: null,
  machineId: "",
  department: "",
  line: "",
  status: "",
  level: "",
  action: "",
  severity: "",
  alertStatus: "",
  maintenanceStatus: "",
  search: "",
};

/** @deprecated use PageFilterState */
export type LogFilterState = Pick<
  PageFilterState,
  "dateFrom" | "dateTo" | "machineId" | "level" | "action" | "search"
>;

export const defaultLogFilters: LogFilterState = {
  dateFrom: null,
  dateTo: null,
  machineId: "",
  level: "",
  action: "",
  search: "",
};

function matchesSearch(hay: string, q: string): boolean {
  return hay.toLowerCase().includes(q.toLowerCase());
}

function inDateRange(iso: string, from: Dayjs | null, to: Dayjs | null): boolean {
  if (from && dayjs(iso).isBefore(from, "day")) return false;
  if (to && dayjs(iso).isAfter(to, "day")) return false;
  return true;
}

export function filterMachines(machines: Machine[], f: PageFilterState): Machine[] {
  return machines.filter((m) => {
    if (f.machineId && m.id !== f.machineId) return false;
    if (f.department && m.department !== f.department) return false;
    if (f.line && m.line !== f.line) return false;
    if (f.status && m.status !== f.status) return false;
    if (f.search) {
      const hay = `${m.code} ${m.name} ${m.type} ${m.location} ${m.ipAddress}`;
      if (!matchesSearch(hay, f.search)) return false;
    }
    return true;
  });
}

export function filterLogRows(rows: LogRow[], f: PageFilterState): LogRow[] {
  return rows.filter((row) => {
    if (f.machineId && row.machineId !== f.machineId) return false;
    if (f.level && row.level !== f.level) return false;
    if (f.action && row.action !== f.action) return false;
    if (!inDateRange(row.timestamp, f.dateFrom, f.dateTo)) return false;
    if (f.search) {
      const hay = `${row.message} ${row.action} ${row.user} ${row.machineName} ${row.machineCode}`;
      if (!matchesSearch(hay, f.search)) return false;
    }
    return true;
  });
}

export function filterAlerts(alerts: Alert[], f: PageFilterState): Alert[] {
  return alerts.filter((a) => {
    if (f.machineId && a.machineId !== f.machineId) return false;
    if (f.severity && a.severity !== f.severity) return false;
    if (f.alertStatus && a.status !== f.alertStatus) return false;
    if (!inDateRange(a.triggeredAt, f.dateFrom, f.dateTo)) return false;
    if (f.search) {
      const hay = `${a.message} ${a.machineCode} ${a.machineName} ${a.ruleName}`;
      if (!matchesSearch(hay, f.search)) return false;
    }
    return true;
  });
}

export function filterMaintenance(items: MaintenancePlan[], f: PageFilterState): MaintenancePlan[] {
  return items.filter((item) => {
    if (f.machineId && item.machineId !== f.machineId) return false;
    if (f.maintenanceStatus && item.status !== f.maintenanceStatus) return false;
    if (!inDateRange(item.scheduledAt, f.dateFrom, f.dateTo)) return false;
    if (f.search) {
      const hay = `${item.description} ${item.assignee} ${item.machineCode} ${item.machineName}`;
      if (!matchesSearch(hay, f.search)) return false;
    }
    return true;
  });
}

export function filterAudit(entries: AuditEntry[], f: PageFilterState): AuditEntry[] {
  return entries.filter((e) => {
    if (!inDateRange(e.timestamp, f.dateFrom, f.dateTo)) return false;
    if (f.search) {
      const hay = `${e.action} ${e.operator} ${e.entityType} ${e.entityId} ${e.details}`;
      if (!matchesSearch(hay, f.search)) return false;
    }
    return true;
  });
}

export function uniqueActions(rows: LogRow[]): string[] {
  return [...new Set(rows.map((r) => r.action))].sort();
}

export function uniqueDepartments(machines: Machine[]): string[] {
  return [...new Set(machines.map((m) => m.department).filter(Boolean) as string[])].sort();
}

export function uniqueLines(machines: Machine[], department?: string): string[] {
  return [
    ...new Set(
      machines
        .filter((m) => !department || m.department === department)
        .map((m) => m.line)
        .filter(Boolean) as string[],
    ),
  ].sort();
}
