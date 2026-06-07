import { describe, it, expect } from "vitest";
import {
  filterMachines,
  filterLogRows,
  filterAlerts,
  defaultPageFilters,
} from "./filters";
import type { Machine, LogRow, Alert } from "@/types";

const machine = (overrides: Partial<Machine> = {}): Machine => ({
  id: "m-1",
  name: "Pressa 1",
  code: "CTS-001",
  type: "Pressa",
  location: "Reparto A - Linea 1",
  department: "Reparto A",
  line: "Linea 1",
  status: "online",
  ipAddress: "10.0.0.1",
  lastSeen: new Date().toISOString(),
  interconnected: true,
  ...overrides,
});

describe("filterMachines", () => {
  it("filtra per stato", () => {
    const list = [machine(), machine({ id: "m-2", status: "offline" })];
    const result = filterMachines(list, { ...defaultPageFilters, status: "offline" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m-2");
  });

  it("filtra per reparto", () => {
    const list = [machine(), machine({ id: "m-2", department: "Reparto B" })];
    const result = filterMachines(list, { ...defaultPageFilters, department: "Reparto A" });
    expect(result).toHaveLength(1);
  });
});

describe("filterLogRows", () => {
  const row: LogRow = {
    id: "l-1",
    machineId: "m-1",
    timestamp: new Date().toISOString(),
    action: "CONNECT",
    level: "info",
    message: "ok",
    user: "sistema",
    machineName: "Pressa",
    machineCode: "CTS-001",
    machineLocation: "A",
  };

  it("filtra per livello", () => {
    const rows = [row, { ...row, id: "l-2", level: "error" as const }];
    const result = filterLogRows(rows, { ...defaultPageFilters, level: "error" });
    expect(result).toHaveLength(1);
  });
});

describe("filterAlerts", () => {
  const alert: Alert = {
    id: "a-1",
    machineId: "m-1",
    ruleId: "r1",
    ruleName: "Test",
    severity: "critical",
    status: "active",
    message: "msg",
    triggeredAt: new Date().toISOString(),
  };

  it("filtra per severità", () => {
    const result = filterAlerts(
      [alert, { ...alert, id: "a-2", severity: "warning" }],
      { ...defaultPageFilters, severity: "warning" },
    );
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("warning");
  });
});
