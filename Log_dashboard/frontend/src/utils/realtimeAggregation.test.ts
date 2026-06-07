import { describe, it, expect } from "vitest";
import { aggregateRecentMinutes, formatRealtimeTick } from "./realtimeAggregation";
import type { LogEntry } from "@/types";

const log = (minutesAgo: number): LogEntry => ({
  id: `l-${minutesAgo}`,
  machineId: "m-1",
  timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  action: "CONNECT",
  level: "info",
  message: "test",
  user: "sistema",
});

describe("aggregateRecentMinutes", () => {
  it("crea bucket per ultima ora", () => {
    const points = aggregateRecentMinutes([log(10), log(20)], 60, 5);
    expect(points.length).toBe(12);
    expect(points.reduce((s, p) => s + p.count, 0)).toBe(2);
  });
});

describe("formatRealtimeTick", () => {
  it("formatta ora", () => {
    expect(formatRealtimeTick(new Date().toISOString())).toMatch(/\d{2}:\d{2}/);
  });
});
