import type { MaintenancePlan, NewMaintenanceInput } from "@/types";
import { apiClient, apiWrite, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockMaintenance } from "@/mocks/extendedData";

export const maintenanceService = {
  list(): Promise<MaintenancePlan[]> {
    return withFallback(
      async () => (await apiClient.get<MaintenancePlan[]>(endpoints.maintenance)).data,
      () => structuredClone(mockMaintenance),
    );
  },

  create(input: NewMaintenanceInput): Promise<MaintenancePlan> {
    return apiWrite(async () =>
      (await apiClient.post<MaintenancePlan>(endpoints.maintenance, input)).data,
    );
  },

  update(id: string, patch: Partial<MaintenancePlan>): Promise<MaintenancePlan> {
    return apiWrite(async () =>
      (await apiClient.patch<MaintenancePlan>(endpoints.maintenanceItem(id), patch)).data,
    );
  },

  remove(id: string): Promise<void> {
    return apiWrite(async () => {
      await apiClient.delete(endpoints.maintenanceItem(id));
    });
  },
};
