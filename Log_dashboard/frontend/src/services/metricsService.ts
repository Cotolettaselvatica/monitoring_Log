import type { FleetMetrics, MachineMetrics } from "@/types";
import { apiClient, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockFleetMetrics, mockMachineMetrics } from "@/mocks/extendedData";

export const metricsService = {
  fleet(periodDays = 7): Promise<FleetMetrics> {
    return withFallback(
      async () =>
        (await apiClient.get<FleetMetrics>(endpoints.metricsFleet, { params: { periodDays } }))
          .data,
      () => ({ ...mockFleetMetrics, periodLabel: `Ultimi ${periodDays} giorni` }),
    );
  },

  machine(machineId: string, periodDays = 7): Promise<MachineMetrics> {
    return withFallback(
      async () =>
        (
          await apiClient.get<MachineMetrics>(endpoints.metricsMachine(machineId), {
            params: { periodDays },
          })
        ).data,
      () => ({
        ...mockMachineMetrics(machineId),
        periodLabel: `Ultimi ${periodDays} giorni`,
      }),
    );
  },
};
