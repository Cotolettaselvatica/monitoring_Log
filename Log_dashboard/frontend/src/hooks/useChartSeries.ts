import { useQuery } from "@tanstack/react-query";
import type { ChartPeriod, LogEntry } from "@/types";
import { chartService } from "@/services/chartService";
import { usePollingInterval } from "@/context/SettingsContext";
import { useLogs, useMachineLogs } from "./useData";

function useEventChartSeries(period: ChartPeriod, logs: LogEntry[] | undefined, machineId?: string) {
  const refetchInterval = usePollingInterval();
  const logList = logs ?? [];
  return useQuery({
    queryKey: ["chartSeries", period, machineId ?? "fleet"],
    queryFn: () => chartService.getEventSeries(period, logList, machineId),
    enabled: machineId == null || Boolean(machineId),
    refetchInterval,
  });
}

export function useChartSeries(period: ChartPeriod) {
  const { data: logs } = useLogs();
  return useEventChartSeries(period, logs);
}

export function useMachineChartSeries(machineId: string | undefined, period: ChartPeriod) {
  const { data: logs } = useMachineLogs(machineId);
  return useEventChartSeries(period, logs, machineId);
}
