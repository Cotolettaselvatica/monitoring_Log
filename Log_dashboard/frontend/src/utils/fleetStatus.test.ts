import { describe, expect, it } from "vitest";
import { fleetStatusSummary } from "@/utils/fleetStatus";
import type { AggregatorMachine, Machine } from "@/types";

const dbMachine = (status: Machine["status"]): Machine => ({
  id: "m1",
  name: "Test",
  code: "T1",
  type: "CNC",
  location: "Linea 1",
  status,
  ipAddress: "10.0.0.1",
  lastSeen: new Date().toISOString(),
  interconnected: true,
});

const rdpMachine = (rdpEnabled: boolean): AggregatorMachine => ({
  id: "rdp-1",
  smbHost: "10.0.0.2",
  rdpEnabled,
  nomeMacchinario: "RDP Test",
  nomePezzo: "pezzo",
});

describe("fleetStatusSummary", () => {
  it("combina stati DB e rdpEnabled RDP", () => {
    const summary = fleetStatusSummary(
      [dbMachine("online"), dbMachine("offline")],
      [rdpMachine(true), rdpMachine(false)],
    );

    expect(summary.total).toBe(4);
    expect(summary.online).toBe(2);
    expect(summary.offline).toBe(2);
  });
});
