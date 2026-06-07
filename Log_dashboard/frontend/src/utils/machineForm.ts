import type { Machine, MachineInput } from "@/types";
import { MACHINE_TYPE_OPTIONS } from "@/constants/machineTypes";

const IP_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

const DEFAULT_TYPE = MACHINE_TYPE_OPTIONS[0];

export function emptyMachineInput(): MachineInput {
  return {
    name: "",
    code: "",
    type: DEFAULT_TYPE,
    department: "",
    line: "",
    status: "offline",
    ipAddress: "",
    interconnected: false,
    rdpUrl: "",
  };
}

export function machineToInput(machine: Machine): MachineInput {
  return {
    name: machine.name,
    code: machine.code,
    type: machine.type,
    department: machine.department ?? machine.location.split(" - ")[0] ?? "",
    line: machine.line ?? machine.location.split(" - ")[1] ?? "",
    status: machine.status,
    ipAddress: machine.ipAddress,
    interconnected: machine.interconnected,
    rdpUrl: machine.rdpUrl ?? "",
  };
}

export interface MachineFormErrors {
  code?: string;
  name?: string;
  type?: string;
  department?: string;
  ipAddress?: string;
}

export function validateMachineInput(
  input: MachineInput,
  existing: Machine[],
  editingId?: string,
): MachineFormErrors {
  const errors: MachineFormErrors = {};
  const code = input.code.trim().toUpperCase();

  if (!code) errors.code = "Codice obbligatorio";
  else if (!/^CTS-\d{3,}$/i.test(code) && !/^[A-Z0-9-]{3,}$/.test(code)) {
    errors.code = "Formato consigliato: CTS-001";
  } else if (existing.some((m) => m.code.toUpperCase() === code && m.id !== editingId)) {
    errors.code = "Codice già in uso";
  }

  if (!input.name.trim()) errors.name = "Nome obbligatorio";
  if (!input.type.trim()) errors.type = "Tipo obbligatorio";
  if (!input.department.trim()) errors.department = "Reparto obbligatorio";

  const ip = input.ipAddress.trim();
  if (!ip) errors.ipAddress = "Indirizzo IP obbligatorio";
  else if (!IP_REGEX.test(ip)) errors.ipAddress = "IP non valido (es. 10.20.1.10)";

  return errors;
}

export function hasMachineFormErrors(errors: MachineFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
