import type {
  NewReportScheduleInput,
  NewReportTemplateInput,
  ReportSchedule,
  ReportTemplate,
} from "@/types";
import { apiClient, apiWrite, withFallback } from "./apiClient";
import { endpoints } from "./endpoints";
import { mockReportSchedules, mockReportTemplates } from "@/mocks/extendedData";

export const reportTemplateService = {
  listTemplates(): Promise<ReportTemplate[]> {
    return withFallback(
      async () => (await apiClient.get<ReportTemplate[]>(endpoints.reportTemplates)).data,
      () => structuredClone(mockReportTemplates),
    );
  },

  createTemplate(input: NewReportTemplateInput): Promise<ReportTemplate> {
    return apiWrite(async () =>
      (await apiClient.post<ReportTemplate>(endpoints.reportTemplates, input)).data,
    );
  },

  deleteTemplate(id: string): Promise<void> {
    return apiWrite(async () => {
      await apiClient.delete(endpoints.reportTemplate(id));
    });
  },

  listSchedules(): Promise<ReportSchedule[]> {
    return withFallback(
      async () => (await apiClient.get<ReportSchedule[]>(endpoints.reportSchedules)).data,
      () => structuredClone(mockReportSchedules),
    );
  },

  createSchedule(input: NewReportScheduleInput): Promise<ReportSchedule> {
    return apiWrite(async () =>
      (await apiClient.post<ReportSchedule>(endpoints.reportSchedules, input)).data,
    );
  },

  deleteSchedule(id: string): Promise<void> {
    return apiWrite(async () => {
      await apiClient.delete(endpoints.reportSchedule(id));
    });
  },
};
