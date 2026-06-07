import dayjs, { type Dayjs } from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
import type { LogEntry } from "@/types";

dayjs.extend(weekOfYear);

export interface AggregatePoint {
  key: string;
  count: number;
}

type BucketUnit = "hour" | "day" | "week" | "month" | "year";

function emptyBuckets(
  unit: BucketUnit,
  count: number,
  anchor: Dayjs = dayjs(),
): Map<string, number> {
  const buckets = new Map<string, number>();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = anchor.subtract(i, unit).startOf(unit);
    buckets.set(d.toISOString(), 0);
  }
  return buckets;
}

function bucketKey(timestamp: string, unit: BucketUnit): string {
  return dayjs(timestamp).startOf(unit).toISOString();
}

function aggregateIntoBuckets(
  logs: LogEntry[],
  buckets: Map<string, number>,
  unit: BucketUnit,
): AggregatePoint[] {
  logs.forEach((log) => {
    const key = bucketKey(log.timestamp, unit);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  });
  return [...buckets.entries()].map(([key, count]) => ({ key, count }));
}

/** Ultime 24 ore, aggregato per ora */
export function aggregateHourly(logs: LogEntry[], hours = 24): AggregatePoint[] {
  return aggregateIntoBuckets(logs, emptyBuckets("hour", hours), "hour");
}

/** Ultimi N giorni, aggregato per giorno */
export function aggregateDaily(logs: LogEntry[], days = 7): AggregatePoint[] {
  return aggregateIntoBuckets(logs, emptyBuckets("day", days), "day");
}

/** Ultime N settimane, aggregato per settimana */
export function aggregateWeekly(logs: LogEntry[], weeks = 8): AggregatePoint[] {
  return aggregateIntoBuckets(logs, emptyBuckets("week", weeks), "week");
}

/** Ultimi N mesi, aggregato per mese */
export function aggregateMonthly(logs: LogEntry[], months = 12): AggregatePoint[] {
  return aggregateIntoBuckets(logs, emptyBuckets("month", months), "month");
}

/** Ultimi N anni, aggregato per anno */
export function aggregateYearly(logs: LogEntry[], years = 5): AggregatePoint[] {
  return aggregateIntoBuckets(logs, emptyBuckets("year", years), "year");
}

export function formatAggregateTick(key: string, unit: BucketUnit): string {
  const d = dayjs(key);
  switch (unit) {
    case "hour":
      return d.format("HH:mm");
    case "day":
      return d.format("DD/MM");
    case "week":
      return `S${d.week()} ${d.format("YY")}`;
    case "month":
      return d.format("MMM YY");
    case "year":
      return d.format("YYYY");
    default:
      return d.format("DD/MM/YY");
  }
}

export function formatAggregateTooltip(key: string, count: number, unit: BucketUnit): string {
  const d = dayjs(key);
  const labels: Record<BucketUnit, string> = {
    hour: d.format("DD/MM/YYYY HH:mm"),
    day: d.format("DD/MM/YYYY"),
    week: `Settimana ${d.week()} — ${d.format("DD/MM/YYYY")}`,
    month: d.format("MMMM YYYY"),
    year: d.format("YYYY"),
  };
  return `${labels[unit]}: ${count} eventi`;
}
