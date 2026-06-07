import type {
  Alert,
  AlertRule,
  MaintenancePlan,
  FleetMetrics,
  MachineMetrics,
  AuditEntry,
  AppSettings,
  ReportTemplate,
  ReportSchedule,
} from "@/types";
import { mockMachines } from "./data";

export const mockSettings: AppSettings = {
  rdpGatewayUrl:
    (import.meta.env.VITE_RDP_GATEWAY_URL as string | undefined) ??
    "https://guacamole.local/guacamole",
  pollingIntervalSec: 30,
  offlineThresholdMin: 15,
  errorThresholdPerHour: 5,
  themeMode: "light",
};

export const mockAlertRules: AlertRule[] = [
  { id: "r1", name: "Macchinario offline", condition: "offline > 15 min", severity: "critical", enabled: true },
  { id: "r2", name: "Errori frequenti", condition: "errori/ora > 5", severity: "warning", enabled: true },
  { id: "r3", name: "Interconnessione persa", condition: "disconnect", severity: "warning", enabled: true },
];

export const mockAlerts: Alert[] = mockMachines
  .filter((m) => m.status === "offline" || m.status === "error" || m.status === "warning")
  .slice(0, 8)
  .map((m, i) => ({
    id: `a-${i + 1}`,
    machineId: m.id,
    machineCode: m.code,
    machineName: m.name,
    ruleId: m.status === "offline" ? "r1" : "r2",
    ruleName: m.status === "offline" ? "Macchinario offline" : "Errori frequenti",
    severity: m.status === "offline" || m.status === "error" ? "critical" : "warning",
    status: i % 3 === 0 ? "acknowledged" : "active",
    message: `Allarme su ${m.code}: stato ${m.status}`,
    triggeredAt: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    acknowledgedBy: i % 3 === 0 ? "operatore.rossi" : undefined,
    acknowledgedAt: i % 3 === 0 ? new Date().toISOString() : undefined,
  }));

export const mockMaintenance: MaintenancePlan[] = mockMachines.slice(0, 10).map((m, i) => ({
  id: `mp-${i + 1}`,
  machineId: m.id,
  machineCode: m.code,
  machineName: m.name,
  type: i % 2 === 0 ? "ordinaria" : "straordinaria",
  scheduledAt: new Date(Date.now() + i * 24 * 3600_000).toISOString(),
  dueAt: new Date(Date.now() + (i + 3) * 24 * 3600_000).toISOString(),
  status: (["pianificata", "in_corso", "completata", "scaduta"] as const)[i % 4],
  assignee: "manutenzione.verdi",
  description: `Intervento ${i % 2 === 0 ? "ordinario" : "straordinario"} su ${m.code}`,
}));

export const mockFleetMetrics: FleetMetrics = {
  periodLabel: "Ultimi 7 giorni",
  uptimePct: 94.2,
  downtimeMinutes: 482,
  mtbfHours: null,
  mttrMinutes: null,
  failures: 17,
  machinesOnline: mockMachines.filter((m) => m.status === "online").length,
  machinesTotal: mockMachines.length,
};

export function mockMachineMetrics(machineId: string): MachineMetrics {
  const m = mockMachines.find((x) => x.id === machineId);
  const base = m?.status === "online" ? 96 : m?.status === "warning" ? 88 : 72;
  return {
    machineId,
    periodLabel: "Ultimi 7 giorni",
    uptimePct: base + (machineId.charCodeAt(2) % 5),
    downtimeMinutes: Math.round((100 - base) * 4),
    mtbfHours: null,
    mttrMinutes: null,
    failures: m?.status === "error" ? 5 : 2,
  };
}

export const mockAudit: AuditEntry[] = [
  {
    id: "au-1",
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    operator: "operatore.rossi",
    action: "ACK_ALERT",
    entityType: "alert",
    entityId: "a-1",
    details: "Presa in carico allarme",
  },
  {
    id: "au-2",
    timestamp: new Date(Date.now() - 7200_000).toISOString(),
    operator: "manutenzione.verdi",
    action: "CREATE_MAINTENANCE",
    entityType: "maintenance",
    entityId: "mp-1",
    details: "Pianificazione manutenzione ordinaria",
  },
  {
    id: "au-3",
    timestamp: new Date(Date.now() - 86400_000).toISOString(),
    operator: "sistema",
    action: "EXPORT_REPORT",
    entityType: "report",
    entityId: "logs",
    details: "Export PDF report log",
  },
];

export const mockReportTemplates: ReportTemplate[] = [
  {
    id: "rt-1",
    name: "Log interconnessione giornaliero",
    description: "Preset filtri ultime 24h per reparto",
    filterSnapshot: { level: "", action: "" },
    pivotConfig: { rowField: "machineCode", colField: "action", agg: "count" },
    defaultFormat: "pdf",
    createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
  },
];

export const mockReportSchedules: ReportSchedule[] = [
  {
    id: "rs-1",
    templateId: "rt-1",
    templateName: "Log interconnessione giornaliero",
    cadence: "daily",
    recipients: "supervisione@cliente.it",
    nextRun: new Date(Date.now() + 86400_000).toISOString(),
    enabled: true,
  },
];
