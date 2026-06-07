import type { Alert } from "@/types";
import { apiClient, apiWrite, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockAlerts } from "@/mocks/extendedData";

export const alertService = {
  list(): Promise<Alert[]> {
    return withFallback(
      async () => (await apiClient.get<Alert[]>(endpoints.alerts)).data,
      () => structuredClone(mockAlerts),
    );
  },

  acknowledge(id: string, operator: string): Promise<Alert> {
    return apiWrite(async () =>
      (
        await apiClient.post<Alert>(endpoints.alertAck(id), { operator })
      ).data,
    );
  },
};
