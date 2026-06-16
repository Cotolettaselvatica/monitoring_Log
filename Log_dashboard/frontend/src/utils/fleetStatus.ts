import type { AggregatorMachine, Machine, MachineStatus } from "@/types";

export interface FleetStatusSummary {
  total: number;
  online: number;
  offline: number;
  warning: number;
  statusData: { status: MachineStatus; count: number }[];
}

/** Conteggi online/offline: macchinari DB + macchine RDP (machines.yaml). */
export function fleetStatusSummary(
  machines: Machine[],
  aggregatorMachines: AggregatorMachine[] = [],
): FleetStatusSummary {
  const counts: Record<MachineStatus, number> = { online: 0, offline: 0, warning: 0, error: 0 };

  machines.forEach((m) => {
    counts[m.status] += 1;
  });

  aggregatorMachines.forEach((m) => {
    counts[m.rdpEnabled ? "online" : "offline"] += 1;
  });

  return {
    total: machines.length + aggregatorMachines.length,
    online: counts.online,
    offline: counts.offline,
    warning: counts.warning + counts.error,
    statusData: (Object.entries(counts) as [MachineStatus, number][])
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count })),
  };
}
