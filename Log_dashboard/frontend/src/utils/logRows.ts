import type { LogEntry, LogRow, Machine } from "@/types";

/** Arricchisce i log con dati macchinario per griglie e export. */
export function enrichLogRows(logs: LogEntry[], machines: Machine[]): LogRow[] {
  const byId = new Map(machines.map((m) => [m.id, m]));
  return logs.map((log) => toLogRow(log, byId.get(log.machineId)));
}

export function enrichLogsForMachine(logs: LogEntry[], machine: Machine): LogRow[] {
  return logs.map((log) => toLogRow(log, machine));
}

function toLogRow(log: LogEntry, machine?: Machine): LogRow {
  return {
    ...log,
    machineName: machine?.name ?? log.machineId,
    machineCode: machine?.code ?? "-",
    machineLocation: machine?.location ?? "-",
    machineImageUrl: machine?.imageUrl,
  };
}
