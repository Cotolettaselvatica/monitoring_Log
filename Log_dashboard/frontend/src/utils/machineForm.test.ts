import { describe, it, expect } from "vitest";
import { validateMachineInput, hasMachineFormErrors } from "./machineForm";
import type { MachineInput, Machine } from "@/types";

const base: MachineInput = {
  name: "Pressa 1",
  code: "CTS-099",
  type: "Pressa",
  department: "Reparto A",
  line: "Linea 1",
  status: "offline",
  ipAddress: "10.20.1.50",
  interconnected: true,
};

const existing: Machine[] = [
  {
    id: "m-1",
    name: "X",
    code: "CTS-001",
    type: "T",
    location: "A",
    status: "online",
    ipAddress: "10.0.0.1",
    lastSeen: new Date().toISOString(),
    interconnected: true,
  },
];

describe("validateMachineInput", () => {
  it("accetta input valido", () => {
    const errors = validateMachineInput(base, existing);
    expect(hasMachineFormErrors(errors)).toBe(false);
  });

  it("rifiuta codice duplicato", () => {
    const errors = validateMachineInput({ ...base, code: "CTS-001" }, existing);
    expect(errors.code).toBeTruthy();
  });

  it("rifiuta IP non valido", () => {
    const errors = validateMachineInput({ ...base, ipAddress: "999" }, existing);
    expect(errors.ipAddress).toBeTruthy();
  });
});
