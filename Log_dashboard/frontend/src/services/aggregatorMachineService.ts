import type { AggregatorMachine } from "@/types";
import { apiClient, withFallback } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import { mockAggregatorMachines } from "@/mocks/aggregatorMachines";

export const aggregatorMachineService = {
  list(): Promise<AggregatorMachine[]> {
    return withFallback(
      () => apiClient.get<AggregatorMachine[]>(endpoints.aggregatorMachines).then((r) => r.data),
      () => mockAggregatorMachines,
    );
  },
};
