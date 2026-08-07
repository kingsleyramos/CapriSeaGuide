import { describe, expect, it } from "vitest";
import { REFRESH } from "@/config/tuning";
import {
  deriveSegments,
  grottoPollDelayMs,
  isWithinGrottoHours,
  modeledSegments,
} from "./grotto-actual";
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

  it("bounds the last run at dayEndMin (today's last check) instead of close", () => {
    const readings = [
      r("2026-08-04T07:00:00Z", "open"), // 09:00
      r("2026-08-04T09:30:00Z", "closed"), // 11:30
    ];
    // Last check at 13:00 (780 min): the closed run ends there, not at 17:30.
    const segs = deriveSegments(readings, "2026-08-04", TZ, 780);
    expect(segs.map((s) => s.status)).toEqual(["open", "closed"]);
    expect(segs[1].start).toBe("11:30");
    expect(segs[1].end).toBe("13:00");
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

describe("modeledSegments", () => {
  it("bands hourly model odds into expected-open / possible-closure", () => {
    // Low odds all day except a rough midday (12:00-14:00) over the 0.3 band.
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      grotto: hour >= 12 && hour < 14 ? 0.8 : 0.1,
    }));
    const segs = modeledSegments(hours, "2026-08-04");
    expect(segs.map((s) => s.tone)).toEqual(["expectedOpen", "possibleClosure", "expectedOpen"]);
    expect(segs[0].start).toBe("09:00");
    expect(segs[segs.length - 1].end).toBe("17:30");
  });

  it("starts the forecast at fromMin (today's last check)", () => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, grotto: 0.1 }));
    const segs = modeledSegments(hours, "2026-08-04", { fromMin: 780 }); // 13:00
    expect(segs).toHaveLength(1);
    expect(segs[0].tone).toBe("expectedOpen");
    expect(segs[0].start).toBe("13:00");
    expect(segs[0].end).toBe("17:30");
  });

  it("returns nothing when there are no hours in the opening window", () => {
    expect(modeledSegments([], "2026-08-04")).toEqual([]);
  });
});

describe("isWithinGrottoHours", () => {
  // Summer closes at 17:30, winter at 14:00; both open at 09:00 Capri time.
  it("brackets the summer day at 09:00 and 17:30", () => {
    expect(isWithinGrottoHours(Date.parse("2026-08-04T06:59:00Z"), TZ)).toBe(false);
    expect(isWithinGrottoHours(Date.parse("2026-08-04T07:00:00Z"), TZ)).toBe(true);
    expect(isWithinGrottoHours(Date.parse("2026-08-04T15:29:00Z"), TZ)).toBe(true);
    expect(isWithinGrottoHours(Date.parse("2026-08-04T15:30:00Z"), TZ)).toBe(false);
  });

  it("closes at 14:00 in winter, when Capri is UTC+1", () => {
    expect(isWithinGrottoHours(Date.parse("2026-01-15T12:59:00Z"), TZ)).toBe(true);
    expect(isWithinGrottoHours(Date.parse("2026-01-15T13:00:00Z"), TZ)).toBe(false);
  });
});

describe("grottoPollDelayMs", () => {
  it("polls on the recorder's cadence inside hours, and backs off outside", () => {
    expect(grottoPollDelayMs(Date.parse("2026-08-04T10:00:00Z"))).toBe(REFRESH.liveIntervalMs);
    expect(grottoPollDelayMs(Date.parse("2026-08-04T22:00:00Z"))).toBe(REFRESH.intervalMs);
  });

  it("stays inside the poll cadence it is meant to keep up with", () => {
    expect(REFRESH.liveIntervalMs).toBeLessThan(30 * 60_000);
  });
});
