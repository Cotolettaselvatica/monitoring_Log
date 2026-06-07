import type { LogEntry } from "@/types";
import { apiClient, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockLogs } from "@/mocks/data";

export const logService = {
  list(): Promise<LogEntry[]> {
    return withFallback(
      async () => (await apiClient.get<LogEntry[]>(endpoints.logs)).data,
      () => structuredClone(mockLogs),
    );
  },

  listByMachine(machineId: string): Promise<LogEntry[]> {
    return withFallback(
      async () =>
        (await apiClient.get<LogEntry[]>(endpoints.machineLogs(machineId))).data,
      () => mockLogs.filter((l) => l.machineId === machineId),
    );
  },
};
