import type { AppSettings } from "@/types";
import { apiClient, apiWrite, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockSettings } from "@/mocks/extendedData";

export const settingsService = {
  get(): Promise<AppSettings> {
    return withFallback(
      async () => (await apiClient.get<AppSettings>(endpoints.settings)).data,
      () => ({ ...mockSettings }),
    );
  },

  update(settings: AppSettings): Promise<AppSettings> {
    return apiWrite(async () =>
      (await apiClient.put<AppSettings>(endpoints.settings, settings)).data,
    );
  },
};
