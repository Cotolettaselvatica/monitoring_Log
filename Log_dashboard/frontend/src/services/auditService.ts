import type { AuditEntry } from "@/types";
import { apiClient, apiWrite, hasApi, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockAudit } from "@/mocks/extendedData";

export interface AuditLogInput {
  operator: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export const auditService = {
  list(): Promise<AuditEntry[]> {
    return withFallback(
      async () => (await apiClient.get<AuditEntry[]>(endpoints.audit)).data,
      () => structuredClone(mockAudit).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    );
  },

  log(input: AuditLogInput): Promise<AuditEntry> {
    if (!hasApi) {
      return Promise.resolve({
        id: `audit-local-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...input,
      });
    }
    return apiWrite(async () =>
      (await apiClient.post<AuditEntry>(endpoints.audit, input)).data,
    );
  },
};
