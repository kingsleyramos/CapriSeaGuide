import { describe, expect, it } from "vitest";
import { deriveSegments, estimateSegments } from "./grotto-actual";
import type { GrottoReading } from "./types";

const TZ = "Europe/Rome";
// Summer: Capri is UTC+2, so Rome HH:MM = UTC (HH-2):MM.
const r = (iso: string, status: GrottoReading["status"]): GrottoReading => ({
  t: Date.parse(iso),
  status,
});

describe("deriveSegments", () => {
  it("builds open/closed segments across opening hours with transition times", () => {
    // Opens, closes at 11:30 (weather), then reopens at 14:00.
    const readings = [
      r("2026-08-04T07:00:00Z", "open"), // 09:00 Rome
      r("2026-08-04T08:30:00Z", "open"), // 10:30
      r("2026-08-04T09:30:00Z", "closed"), // 11:30
      r("2026-08-04T10:30:00Z", "closed"), // 12:30
      r("2026-08-04T12:00:00Z", "open"), // 14:00
      r("2026-08-04T14:00:00Z", "open"), // 16:00
    ];
    const segs = deriveSegments(readings, "2026-08-04", TZ);

    expect(segs.map((s) => s.status)).toEqual(["open", "closed", "open"]);
    // First runs from opening (9:00); last ends at the summer close (17:30).
    expect(segs[0].start).toBe("09:00");
    expect(segs[1].start).toBe("11:30");
    expect(segs[2].start).toBe("14:00");
    expect(segs[2].end).toBe("17:30");
  });

  it("returns one segment for a steady day", () => {
    const readings = [
      r("2026-08-04T07:00:00Z", "open"),
      r("2026-08-04T10:00:00Z", "open"),
      r("2026-08-04T14:00:00Z", "open"),
    ];
    const segs = deriveSegments(readings, "2026-08-04", TZ);
    expect(segs).toHaveLength(1);
    expect(segs[0].status).toBe("open");
    expect(segs[0].start).toBe("09:00");
    expect(segs[0].end).toBe("17:30");
  });

  it("uses the winter close for winter dates", () => {
    const readings = [r("2026-01-15T09:00:00Z", "open")]; // 10:00 Rome (CET)
    const segs = deriveSegments(readings, "2026-01-15", TZ);
    expect(segs[0].end).toBe("14:00");
  });

  it("returns nothing for a day with no readings", () => {
    const segs = deriveSegments([r("2026-08-01T10:00:00Z", "open")], "2026-08-04", TZ);
    expect(segs).toEqual([]);
  });
});

describe("estimateSegments", () => {
  it("thresholds hourly model odds into open/closed segments", () => {
    // Low odds all day except a rough midday (12:00-14:00) that reads closed.
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      grotto: hour >= 12 && hour < 14 ? 0.8 : 0.1,
    }));
    const segs = estimateSegments(hours, "2026-08-04");
    expect(segs.map((s) => s.status)).toEqual(["open", "closed", "open"]);
    expect(segs[0].start).toBe("09:00");
    expect(segs[segs.length - 1].end).toBe("17:30");
  });

  it("returns nothing when there are no hours in the opening window", () => {
    expect(estimateSegments([], "2026-08-04")).toEqual([]);
  });
});
