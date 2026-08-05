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
    expect(before.line).toMatch(/Opens around 09:00/);

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
  it("renders segments as a bar and grid, scaled to the latest close shown", () => {
    const payload: HistoryDayPayload[] = [
      {
        date: "2026-08-04",
        label: "Tue 4 Aug",
        kind: "reported",
        segments: [
          { startMin: 540, endMin: 690, start: "09:00", end: "11:30", status: "open", transitionLabel: null, cells: { swell: "0.4 m" } },
          { startMin: 690, endMin: 1050, start: "11:30", end: "17:30", status: "closed", transitionLabel: "11:30", cells: { swell: "0.9 m" } },
        ],
      },
    ];
    const { days, axis } = buildHistoryView(payload);
    const v = days[0];
    expect(v.kind).toBe("reported");
    expect(v.bar.map((b) => b.status)).toEqual(["open", "closed"]);
    // Summer close 17:30 sets the span (510 min); the 150-min open segment is 29.4%.
    expect(v.bar[0].widthPct).toBeCloseTo((150 / 510) * 100, 5);
    expect(v.rows[1].time).toBe("11:30–17:30");
    expect(v.rows[1].cells.swell).toBe("0.9 m");
    expect(axis[0].label).toBe("09:00");
    expect(axis[axis.length - 1].label).toBe("17:30");
  });

  it("marks a no-data day as none with an empty grid", () => {
    const payload: HistoryDayPayload[] = [
      { date: "2026-08-04", label: "Tue 4 Aug", kind: "none", segments: [] },
    ];
    const { days } = buildHistoryView(payload);
    expect(days[0].kind).toBe("none");
    expect(days[0].bar[0].status).toBe("none");
    expect(days[0].rows).toEqual([]);
  });
});
