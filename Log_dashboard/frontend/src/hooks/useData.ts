import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { machineService } from "@/services/machineService";
import { logService } from "@/services/logService";
import { noteService, type NewNoteInput } from "@/services/noteService";
import { alertService } from "@/services/alertService";
import { maintenanceService } from "@/services/maintenanceService";
import { metricsService } from "@/services/metricsService";
import { auditService, type AuditLogInput } from "@/services/auditService";
import { settingsService } from "@/services/settingsService";
import { reportTemplateService } from "@/services/reportTemplateService";
import { usePollingInterval } from "@/context/SettingsContext";
import { enrichLogRows } from "@/utils/logRows";
import type {
  LogRow,
  MachineInput,
  NewMaintenanceInput,
  NewReportScheduleInput,
  NewReportTemplateInput,
  AppSettings,
} from "@/types";

export function useMachines() {
  const refetchInterval = usePollingInterval();
  return useQuery({
    queryKey: ["machines"],
    queryFn: () => machineService.list(),
    refetchInterval,
  });
}

export function useMachine(id: string | undefined) {
  const refetchInterval = usePollingInterval();
  return useQuery({
    queryKey: ["machine", id],
    queryFn: () => machineService.getById(id!),
    enabled: Boolean(id),
    refetchInterval,
  });
}

export function useLogs() {
  const refetchInterval = usePollingInterval();
  return useQuery({
    queryKey: ["logs"],
    queryFn: () => logService.list(),
    refetchInterval,
  });
}

export function useMachineLogs(machineId: string | undefined) {
  const refetchInterval = usePollingInterval();
  return useQuery({
    queryKey: ["logs", machineId],
    queryFn: () => logService.listByMachine(machineId!),
    enabled: Boolean(machineId),
    refetchInterval,
  });
}

export function useMachineNotes(machineId: string | undefined) {
  return useQuery({
    queryKey: ["notes", machineId],
    queryFn: () => noteService.listByMachine(machineId!),
    enabled: Boolean(machineId),
  });
}

export function useAlerts() {
  const refetchInterval = usePollingInterval();
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertService.list(),
    refetchInterval,
  });
}

export function useMaintenance() {
  return useQuery({
    queryKey: ["maintenance"],
    queryFn: () => maintenanceService.list(),
  });
}

export function useFleetMetrics(periodDays = 7) {
  const refetchInterval = usePollingInterval();
  return useQuery({
    queryKey: ["metrics", "fleet", periodDays],
    queryFn: () => metricsService.fleet(periodDays),
    refetchInterval,
  });
}

export function useMachineMetrics(machineId: string | undefined, periodDays = 7) {
  const refetchInterval = usePollingInterval();
  return useQuery({
    queryKey: ["metrics", machineId, periodDays],
    queryFn: () => metricsService.machine(machineId!, periodDays),
    enabled: Boolean(machineId),
    refetchInterval,
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit"],
    queryFn: () => auditService.list(),
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: ["reportTemplates"],
    queryFn: () => reportTemplateService.listTemplates(),
  });
}

export function useReportSchedules() {
  return useQuery({
    queryKey: ["reportSchedules"],
    queryFn: () => reportTemplateService.listSchedules(),
  });
}

export function useCreateNote(machineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewNoteInput) => noteService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", machineId] }),
  });
}

export function useCreateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MachineInput) => machineService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines"] }),
  });
}

export function useUpdateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<MachineInput> }) =>
      machineService.update(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["machine", id] });
    },
  });
}

export function useDeleteMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => machineService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines"] }),
  });
}

export function useUploadMachineImage(machineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => machineService.uploadImage(machineId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["machine", machineId] });
    },
  });
}

export function useDeleteMachineImage(machineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => machineService.deleteImage(machineId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["machine", machineId] });
    },
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, operator }: { id: string; operator: string }) =>
      alertService.acknowledge(id, operator),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewMaintenanceInput) => maintenanceService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

export function useUpdateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<import("@/types").MaintenancePlan> }) =>
      maintenanceService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

export function useDeleteMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => maintenanceService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AppSettings) => settingsService.update(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useCreateReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReportTemplateInput) => reportTemplateService.createTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reportTemplates"] }),
  });
}

export function useCreateReportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReportScheduleInput) => reportTemplateService.createSchedule(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reportSchedules"] }),
  });
}

export function useLogAudit() {
  return useMutation({
    mutationFn: (input: AuditLogInput) => auditService.log(input),
    onSuccess: () => {},
  });
}

export function useLogRows() {
  const machinesQuery = useMachines();
  const logsQuery = useLogs();

  const rows = useMemo<LogRow[]>(() => {
    return enrichLogRows(logsQuery.data ?? [], machinesQuery.data ?? []);
  }, [machinesQuery.data, logsQuery.data]);

  return {
    rows,
    isLoading: machinesQuery.isLoading || logsQuery.isLoading,
    isError: machinesQuery.isError || logsQuery.isError,
  };
}

export function useActiveAlertsCount() {
  const { data = [] } = useAlerts();
  return data.filter((a) => a.status === "active").length;
}
