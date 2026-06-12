import type { AggregatorMachine } from "@/types";
import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";

/** Elenco macchine RDP da GET /aggregator-machines (YAML WIN_log_aggregator). */
export const aggregatorMachineService = {
  list(): Promise<AggregatorMachine[]> {
    return apiClient
      .get<AggregatorMachine[]>(endpoints.aggregatorMachines)
      .then((response) => response.data);
  },
};
