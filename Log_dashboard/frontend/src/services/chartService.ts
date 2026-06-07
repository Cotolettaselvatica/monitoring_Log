import type { ChartPeriod, ChartSeriesPoint } from "@/types";
import type { LogEntry } from "@/types";
import { apiClient, withFallback } from "./apiClient";
import {
  aggregateHourly,
  aggregateDaily,
  aggregateWeekly,
  aggregateMonthly,
  aggregateYearly,
  type AggregatePoint,
} from "@/utils/logAggregation";
import { mockLogs } from "@/mocks/data";
import { endpoints } from "./endpoints";

const PERIOD_API_SLUG: Record<ChartPeriod, string> = {
  hour: "hourly",
  day: "daily",
  week: "weekly",
  month: "monthly",
  year: "yearly",
};

const PERIOD_CONFIG: Record<
  ChartPeriod,
  { fleetPath: string; fallback: (logs: LogEntry[]) => AggregatePoint[] }
> = {
  hour: { fleetPath: endpoints.chartHourly, fallback: (logs) => aggregateHourly(logs, 24) },
  day: { fleetPath: endpoints.chartDaily, fallback: (logs) => aggregateDaily(logs, 7) },
  week: { fleetPath: endpoints.chartWeekly, fallback: (logs) => aggregateWeekly(logs, 8) },
  month: { fleetPath: endpoints.chartMonthly, fallback: (logs) => aggregateMonthly(logs, 12) },
  year: { fleetPath: endpoints.chartYearly, fallback: (logs) => aggregateYearly(logs, 5) },
};

function toAggregate(points: ChartSeriesPoint[]): AggregatePoint[] {
  return points.map((p) => ({ key: p.key, count: p.count }));
}

function logsForMachine(logs: LogEntry[], machineId?: string): LogEntry[] {
  if (!machineId) return logs;
  return logs.filter((l) => l.machineId === machineId);
}

function chartApiPath(period: ChartPeriod, machineId?: string): string {
  if (machineId) {
    return endpoints.machineChartEvents(machineId, PERIOD_API_SLUG[period]);
  }
  return PERIOD_CONFIG[period].fleetPath;
}

export const chartService = {
  getEventSeries(
    period: ChartPeriod,
    logsFallback: LogEntry[] = mockLogs,
    machineId?: string,
  ): Promise<AggregatePoint[]> {
    const cfg = PERIOD_CONFIG[period];
    const scopedLogs = logsForMachine(logsFallback, machineId);
    return withFallback(
      async () =>
        toAggregate((await apiClient.get<ChartSeriesPoint[]>(chartApiPath(period, machineId))).data),
      () => cfg.fallback(scopedLogs),
    );
  },
};
