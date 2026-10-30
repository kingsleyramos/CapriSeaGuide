import { describe, expect, it } from "vitest";
import { deriveSegments, modeledSegments, persistedGrottoProb } from "./grotto-actual";
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

describe("persistence of the last recorded call", () => {
  const flat = Array.from({ length: 24 }, (_, hour) => ({ hour, grotto: 0.1 }));

  it("carries a midday closure across the afternoon the model calls calm", () => {
    // Shut at 12:00 with the model at 0.1: without persistence the whole
    // afternoon reads "expected open" while the cave is in fact still closed.
    const segs = modeledSegments(flat, "2026-08-04", {
      fromMin: 720,
      last: { status: "closed", min: 720 },
    });
    expect(segs.map((s) => s.tone)).toEqual(["possibleClosure"]);
    expect(segs[0].end).toBe("17:30");
  });

  it("lets an open call fade to the model within the hour", () => {
    const rough = flat.map((h) => ({ ...h, grotto: h.hour >= 14 ? 0.8 : 0.1 }));
    const segs = modeledSegments(rough, "2026-08-04", {
      fromMin: 720,
      last: { status: "open", min: 720 },
    });
    expect(segs.map((s) => s.tone)).toEqual(["expectedOpen", "possibleClosure"]);
    expect(segs[1].start).toBe("14:00");
  });

  it("decays a closure toward the model, never below it", () => {
    const at = (lag: number) => persistedGrottoProb(0.1, "closed", lag);
    expect(at(0)).toBeCloseTo(1, 6);
    expect(at(1)).toBeGreaterThan(at(3));
    expect(at(3)).toBeGreaterThan(at(6));
    expect(at(48)).toBeGreaterThan(0.1);
    expect(at(48)).toBeCloseTo(0.1, 3);
    // A reading from the future must not weigh more than one from now.
    expect(persistedGrottoProb(0.1, "closed", -5)).toBeCloseTo(1, 6);
  });

  it("never invents risk the model does not see once an open call has aged", () => {
    expect(persistedGrottoProb(0.1, "open", 4)).toBeCloseTo(0.1, 3);
    expect(persistedGrottoProb(0.1, "open", 0)).toBeCloseTo(0, 6);
  });
});
