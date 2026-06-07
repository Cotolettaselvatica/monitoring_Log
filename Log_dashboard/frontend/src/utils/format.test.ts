import { describe, it, expect } from "vitest";
import { formatDateTime, formatRelative, formatDuration, statusLabels } from "./format";

describe("format", () => {
  it("formatDateTime restituisce stringa italiana", () => {
    expect(formatDateTime("2026-06-03T12:00:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("formatRelative per timestamp recente", () => {
    const iso = new Date().toISOString();
    expect(formatRelative(iso)).toBe("adesso");
  });

  it("formatDuration gestisce null e secondi", () => {
    expect(formatDuration(undefined)).toBe("-");
    expect(formatDuration(45_000)).toBe("45s");
  });

  it("statusLabels copre tutti gli stati", () => {
    expect(statusLabels.online).toBe("Online");
    expect(statusLabels.offline).toBe("Offline");
  });
});
