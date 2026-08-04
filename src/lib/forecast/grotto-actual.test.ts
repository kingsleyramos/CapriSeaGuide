import { describe, expect, it } from "vitest";
import { deriveActualDay } from "./grotto-actual";
import type { GrottoReading } from "./types";

const TZ = "Europe/Rome";
// Summer: Capri is UTC+2, so Rome HH:MM = UTC (HH-2):MM.
const r = (iso: string, status: GrottoReading["status"]): GrottoReading => ({
  t: Date.parse(iso),
  status,
});

describe("deriveActualDay", () => {
  it("captures AM/PM status and intra-day transitions with times", () => {
    // A day that opens, closes at 11:30 (weather), then reopens at 14:00.
    const readings = [
      r("2026-08-04T07:00:00Z", "open"), // 09:00 Rome
      r("2026-08-04T08:30:00Z", "open"), // 10:30
      r("2026-08-04T09:30:00Z", "closed"), // 11:30
      r("2026-08-04T10:30:00Z", "closed"), // 12:30
      r("2026-08-04T12:00:00Z", "open"), // 14:00
      r("2026-08-04T14:00:00Z", "open"), // 16:00
    ];
    const day = deriveActualDay(readings, "2026-08-04", TZ);

    expect(day.am).toBe("mixed"); // open then closed across the morning
    expect(day.pm).toBe("open");
    expect(day.transitions).toEqual([
      { time: "11:30", hour: 11, to: "closed" },
      { time: "14:00", hour: 14, to: "open" },
    ]);
  });

  it("reports a steady open day with no transitions", () => {
    const readings = [
      r("2026-08-04T07:00:00Z", "open"),
      r("2026-08-04T10:00:00Z", "open"),
      r("2026-08-04T14:00:00Z", "open"),
    ];
    const day = deriveActualDay(readings, "2026-08-04", TZ);
    expect(day.am).toBe("open");
    expect(day.pm).toBe("open");
    expect(day.transitions).toHaveLength(0);
  });

  it("returns nulls for a day with no readings", () => {
    const other = [r("2026-08-01T10:00:00Z", "open")];
    const day = deriveActualDay(other, "2026-08-04", TZ);
    expect(day).toEqual({ am: null, pm: null, transitions: [] });
  });
});
