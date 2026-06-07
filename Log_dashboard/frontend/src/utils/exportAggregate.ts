import type { AggregatePoint } from "@/utils/logAggregation";
import { formatAggregateTick, formatAggregateTooltip } from "@/utils/logAggregation";
import type { ChartPeriod } from "@/types";
import { exportCsv, exportExcel, exportJson } from "@/utils/exporters";

type BucketUnit = ChartPeriod;

export function aggregateToExportRows(
  points: AggregatePoint[],
  unit: BucketUnit,
): { periodo: string; eventi: number; dettaglio: string }[] {
  return points.map((p) => ({
    periodo: formatAggregateTick(p.key, unit),
    eventi: p.count,
    dettaglio: formatAggregateTooltip(p.key, p.count, unit),
  }));
}

export function exportChartSeries(
  format: "csv" | "excel" | "json",
  points: AggregatePoint[],
  unit: BucketUnit,
  chartSlug: string,
): void {
  const rows = aggregateToExportRows(points, unit);
  const filename = `catis-grafico-${chartSlug}-${new Date().toISOString().slice(0, 10)}`;
  const columns = [
    { key: "periodo" as const, header: "Periodo" },
    { key: "eventi" as const, header: "Eventi" },
    { key: "dettaglio" as const, header: "Dettaglio" },
  ];

  if (format === "json") {
    exportJson(rows, filename);
    return;
  }
  if (format === "csv") {
    exportCsv(rows, columns, filename);
    return;
  }
  exportExcel(rows, columns, filename, "Dati grafico");
}
