import { describe, it, expect } from "vitest";
import { aggregateHourly, aggregateDaily } from "./logAggregation";
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

describe("aggregateHourly", () => {
  it("restituisce 24 bucket", () => {
    const points = aggregateHourly([log(30), log(60)], 24);
    expect(points).toHaveLength(24);
    const total = points.reduce((s, p) => s + p.count, 0);
    expect(total).toBe(2);
  });
});

describe("aggregateDaily", () => {
  it("restituisce 7 bucket", () => {
    const points = aggregateDaily([log(60)], 7);
    expect(points).toHaveLength(7);
  });
});
