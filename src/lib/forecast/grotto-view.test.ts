import { describe, expect, it } from "vitest";
import {
  buildGrottoView,
  buildHistoryView,
  grottoCloseHour,
  isWithinGrottoHours,
  type HistoryDayPayload,
} from "./grotto-view";

const TZ = "Europe/Rome";
const at = (iso: string) => new Date(iso);

describe("grotto opening hours", () => {
  it("uses seasonal close hours", () => {
    expect(grottoCloseHour(7)).toBe(17.5); // August (summer)
    expect(grottoCloseHour(0)).toBe(14); // January (winter)
  });

  it("checks against Capri local time", () => {
    expect(isWithinGrottoHours(at("2026-08-04T10:00:00Z"), TZ)).toBe(true); // 12:00 Rome
    expect(isWithinGrottoHours(at("2026-08-04T05:00:00Z"), TZ)).toBe(false); // 07:00 Rome
    expect(isWithinGrottoHours(at("2026-08-04T18:00:00Z"), TZ)).toBe(false); // 20:00 Rome
    expect(isWithinGrottoHours(at("2026-01-15T13:30:00Z"), TZ)).toBe(false); // 14:30 Rome, winter closes 14:00
  });
});

describe("buildGrottoView state model", () => {
  const base = { conflict: false, timezone: TZ, forecastGrottoProb: 0.4 };

  it("treats an out-of-hours closure as off-hours, not weather", () => {
    const before = buildGrottoView({ ...base, verdict: "open", now: at("2026-08-04T05:00:00Z") });
    expect(before.tone).toBe("offHours");
    expect(before.line).toMatch(/Opens around 9am/);

    const after = buildGrottoView({ ...base, verdict: "closed", now: at("2026-08-04T18:00:00Z") });
    expect(after.tone).toBe("offHours");
    expect(after.line).toMatch(/tomorrow/);
  });

  it("reflects the verdict within opening hours", () => {
    const noon = at("2026-08-04T10:00:00Z");
    expect(buildGrottoView({ ...base, verdict: "open", now: noon }).tone).toBe("open");

    const closed = buildGrottoView({ ...base, verdict: "closed", now: noon });
    expect(closed.tone).toBe("closed");
    expect(closed.line).toMatch(/sea conditions/);
  });

  it("falls back to forecast odds when the verdict is unknown during hours", () => {
    const v = buildGrottoView({ ...base, verdict: "unknown", now: at("2026-08-04T10:00:00Z") });
    expect(v.tone).toBe("unknown");
    expect(v.line).toMatch(/40%/); // pct(0.4)
  });

  it("surfaces a disagreement note when sources conflict", () => {
    const v = buildGrottoView({ ...base, conflict: true, verdict: "open", now: at("2026-08-04T10:00:00Z") });
    expect(v.line).toMatch(/disagree/);
  });
});

describe("buildHistoryView", () => {
  it("renders recorded segments as a bar and grid rows", () => {
    const payload: HistoryDayPayload[] = [
      {
        date: "2026-08-04",
        label: "Tue 4 Aug",
        segments: [
          { startMin: 540, endMin: 690, start: "9:00", end: "11:30", status: "open", transitionLabel: null, cells: { swell: "0.4 m" } },
          { startMin: 690, endMin: 840, start: "11:30", end: "14:00", status: "closed", transitionLabel: "11:30", cells: { swell: "0.9 m" } },
        ],
        modeled: [],
      },
    ];
    const [v] = buildHistoryView(payload);
    expect(v.recorded).toBe(true);
    expect(v.bar.map((b) => b.kind)).toEqual(["open", "closed"]);
    expect(v.bar[0].widthPct).toBeCloseTo((150 / 540) * 100, 5);
    expect(v.rows[1].time).toBe("11:30–14:00");
    expect(v.rows[1].statusKind).toBe("closed");
    expect(v.rows[1].cells.swell).toBe("0.9 m");
  });

  it("falls back to a modeled bar and rows when nothing is recorded", () => {
    const payload: HistoryDayPayload[] = [
      {
        date: "2026-08-04",
        label: "Tue 4 Aug",
        segments: null,
        modeled: [
          { label: "Morning", pct: "4%", tone: "low", cells: { swell: "0.4 m" } },
          { label: "Afternoon", pct: "5%", tone: "low", cells: { swell: "0.5 m" } },
        ],
      },
    ];
    const [v] = buildHistoryView(payload);
    expect(v.recorded).toBe(false);
    expect(v.bar[0].kind).toBe("modeled");
    expect(v.rows.map((r) => r.statusKind)).toEqual(["modeled", "modeled"]);
    expect(v.rows[0].statusLabel).toBe("4%");
  });
});
