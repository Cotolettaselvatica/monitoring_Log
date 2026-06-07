import { describe, expect, it } from "vitest";
import { enrichLogRows, enrichLogsForMachine } from "./logRows";
import type { LogEntry, Machine } from "@/types";

const sampleLog: LogEntry = {
  id: "l1",
  machineId: "m-1",
  timestamp: "2025-01-01T10:00:00Z",
  action: "connect",
  level: "info",
  message: "ok",
  user: "sistema",
};

const sampleMachine: Machine = {
  id: "m-1",
  name: "Pressa 1",
  code: "PR-01",
  type: "press",
  location: "Linea A",
  status: "online",
  ipAddress: "10.0.0.1",
  lastSeen: "2025-01-01T10:00:00Z",
  interconnected: true,
};

describe("logRows", () => {
  it("enrichLogRows maps machine fields", () => {
    const [row] = enrichLogRows([sampleLog], [sampleMachine]);
    expect(row.machineName).toBe("Pressa 1");
    expect(row.machineCode).toBe("PR-01");
  });

  it("enrichLogsForMachine uses single machine", () => {
    const [row] = enrichLogsForMachine([sampleLog], sampleMachine);
    expect(row.machineLocation).toBe("Linea A");
  });
});
