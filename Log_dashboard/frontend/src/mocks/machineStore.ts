import type { Machine, MachineInput } from "@/types";
import { mockMachines as initialMachines } from "./data";

let machines: Machine[] = structuredClone(initialMachines);

const GATEWAY =
  (import.meta.env.VITE_RDP_GATEWAY_URL as string | undefined) ??
  "https://guacamole.local/guacamole";

function composeLocation(department: string, line?: string): { location: string; department?: string; line?: string } {
  const loc = line ? `${department} - ${line}` : department;
  return { location: loc, department: department || undefined, line: line || undefined };
}

function buildRdpUrl(code: string, rdpUrl?: string): string | undefined {
  if (rdpUrl?.trim()) return rdpUrl.trim();
  return `${GATEWAY}/#/client/${code}`;
}

export const mockMachineStore = {
  list(): Machine[] {
    return structuredClone(machines);
  },

  getById(id: string): Machine | undefined {
    return machines.find((m) => m.id === id);
  },

  create(input: MachineInput): Machine {
    const { location, department, line } = composeLocation(input.department, input.line);
    const machine: Machine = {
      id: `m-${Date.now()}`,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      type: input.type.trim(),
      location: input.location?.trim() || location,
      department: input.department?.trim() || department,
      line: input.line?.trim() || line,
      status: input.status,
      ipAddress: input.ipAddress.trim(),
      lastSeen: new Date().toISOString(),
      interconnected: input.interconnected,
      rdpUrl: buildRdpUrl(input.code, input.rdpUrl),
      imageUrl: input.imageUrl,
    };
    machines = [machine, ...machines];
    return structuredClone(machine);
  },

  update(id: string, input: Partial<MachineInput>): Machine {
    const idx = machines.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("Macchinario non trovato");
    const prev = machines[idx];
    const department = input.department ?? prev.department ?? "";
    const line = input.line ?? prev.line;
    const loc =
      input.location?.trim() ||
      composeLocation(department, line).location;
    const code = input.code?.trim().toUpperCase() ?? prev.code;
    const updated: Machine = {
      ...prev,
      ...input,
      code,
      name: input.name?.trim() ?? prev.name,
      type: input.type?.trim() ?? prev.type,
      location: loc,
      department: department || undefined,
      line: line || undefined,
      ipAddress: input.ipAddress?.trim() ?? prev.ipAddress,
      rdpUrl: input.rdpUrl !== undefined ? buildRdpUrl(code, input.rdpUrl) : prev.rdpUrl,
    };
    machines[idx] = updated;
    return structuredClone(updated);
  },

  delete(id: string): void {
    const next = machines.filter((m) => m.id !== id);
    if (next.length === machines.length) throw new Error("Macchinario non trovato");
    machines = next;
  },

  reset(): void {
    machines = structuredClone(initialMachines);
  },
};
