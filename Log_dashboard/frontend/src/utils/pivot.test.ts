import { describe, it, expect } from "vitest";
import { buildPivot } from "./pivot";
import type { LogRow } from "@/types";

const row = (overrides: Partial<LogRow> = {}): LogRow => ({
  id: "1",
  machineId: "m-1",
  timestamp: new Date().toISOString(),
  action: "CONNECT",
  level: "info",
  message: "x",
  user: "u",
  machineName: "M1",
  machineCode: "C1",
  machineLocation: "L1",
  ...overrides,
});

describe("buildPivot", () => {
  it("aggrega per conteggio", () => {
    const result = buildPivot(
      [row(), row({ id: "2", action: "DISCONNECT" }), row({ id: "3", action: "CONNECT" })],
      { rowField: "action", colField: "none", agg: "count" },
    );
    expect(result.grandTotal).toBe(3);
    expect(result.rowKeys).toContain("CONNECT");
  });
});
