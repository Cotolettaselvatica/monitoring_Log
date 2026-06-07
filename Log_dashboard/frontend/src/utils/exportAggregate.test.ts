import { describe, it, expect } from "vitest";
import { aggregateToExportRows } from "./exportAggregate";

describe("aggregateToExportRows", () => {
  it("mappa punti in righe export", () => {
    const rows = aggregateToExportRows(
      [{ key: new Date().toISOString(), count: 5 }],
      "hour",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].eventi).toBe(5);
    expect(rows[0].periodo).toBeTruthy();
  });
});
