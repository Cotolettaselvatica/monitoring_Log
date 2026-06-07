import dayjs from "dayjs";
import type { LogEntry } from "@/types";
import type { AggregatePoint } from "@/utils/logAggregation";

/** Aggrega eventi in bucket da `bucketMinutes` negli ultimi `windowMinutes` minuti. */
export function aggregateRecentMinutes(
  logs: LogEntry[],
  windowMinutes = 60,
  bucketMinutes = 5,
): AggregatePoint[] {
  const bucketCount = Math.max(1, Math.floor(windowMinutes / bucketMinutes));
  const now = dayjs();
  const buckets: { start: dayjs.Dayjs; end: dayjs.Dayjs; key: string }[] = [];

  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const end = now.subtract(i * bucketMinutes, "minute");
    const start = end.subtract(bucketMinutes, "minute");
    buckets.push({ start, end, key: start.toISOString() });
  }

  const counts = new Map(buckets.map((b) => [b.key, 0]));

  logs.forEach((log) => {
    const t = dayjs(log.timestamp);
    for (const b of buckets) {
      if (t.isAfter(b.start) && !t.isAfter(b.end)) {
        counts.set(b.key, (counts.get(b.key) ?? 0) + 1);
        break;
      }
    }
  });

  return buckets.map((b) => ({ key: b.key, count: counts.get(b.key) ?? 0 }));
}

export function formatRealtimeTick(isoKey: string): string {
  return dayjs(isoKey).format("HH:mm");
}
