import { describe, expect, it } from "vitest";
import {
  buildGrottoTimeline,
  buildGrottoView,
  type GrottoTimelinePayload,
} from "./grotto-view";

const TZ = "Europe/Rome";
const at = (iso: string) => new Date(iso);

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
    expect(closed.line).toMatch(/reported closed/i);
    // The source publishes "closed" and no reason, so neither do we.
    expect(closed.line).not.toMatch(/sea conditions/i);
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

describe("buildGrottoTimeline", () => {
  it("renders the today bar as reported so far + forecast, split at the last check", () => {
    const payload: GrottoTimelinePayload = {
      today: {
        date: "2026-08-04",
        label: "Today",
        lastCheckMin: 780, // 13:00
        lastCheckLabel: "13:00",
        bar: [
          { startMin: 540, endMin: 780, tone: "open", label: null },
          { startMin: 780, endMin: 1050, tone: "expectedOpen", label: null },
        ],
      },
      days: [],
    };
    const { today, axis } = buildGrottoTimeline(payload);
    expect(today).not.toBeNull();
    expect(today!.bar.map((b) => b.tone)).toEqual(["open", "expectedOpen"]);
    // Summer close 17:30 sets the span (510 min); 09:00→13:00 divider is 47.06%.
    expect(today!.dividerPct).toBeCloseTo((240 / 510) * 100, 5);
    expect(today!.dividerLabel).toBe("reported as of 13:00");
    expect(axis[0].label).toBe("09:00");
    expect(axis[axis.length - 1].label).toBe("17:30");
  });

  it("renders a reported day as solid runs with the sea at each change", () => {
    const payload: GrottoTimelinePayload = {
      today: null,
      days: [
        {
          date: "2026-08-04",
          label: "Tue 4 Aug",
          kind: "reported",
          bar: [
            { startMin: 540, endMin: 690, tone: "open", label: null },
            { startMin: 690, endMin: 1050, tone: "closed", label: "11:30" },
          ],
          rows: [
            { time: "09:00–11:30", statusLabel: "Open", tone: "open", cells: { swell: "0.4 m" } },
            { time: "11:30–17:30", statusLabel: "Closed", tone: "closed", cells: { swell: "0.9 m" } },
          ],
        },
      ],
    };
    const { days } = buildGrottoTimeline(payload);
    const v = days[0];
    expect(v.kind).toBe("reported");
    expect(v.bar.map((b) => b.tone)).toEqual(["open", "closed"]);
    // Summer close 17:30 sets the span (510 min); the 150-min open run is 29.4%.
    expect(v.bar[0].widthPct).toBeCloseTo((150 / 510) * 100, 5);
    expect(v.rows[1].time).toBe("11:30–17:30");
    expect(v.rows[1].statusLabel).toBe("Closed");
    expect(v.rows[1].cells.swell).toBe("0.9 m");
  });

  it("renders a no-data day as one grey bar with morning/afternoon sea", () => {
    const payload: GrottoTimelinePayload = {
      today: null,
      days: [
        {
          date: "2026-08-04",
          label: "Tue 4 Aug",
          kind: "none",
          bar: [{ startMin: 540, endMin: 1050, tone: "none", label: null }],
          rows: [
            { time: "Morning", statusLabel: "No data", tone: "none", cells: { swell: "0.5 m" } },
            { time: "Afternoon", statusLabel: "No data", tone: "none", cells: { swell: "0.7 m" } },
          ],
        },
      ],
    };
    const { days } = buildGrottoTimeline(payload);
    expect(days[0].kind).toBe("none");
    expect(days[0].bar[0].tone).toBe("none");
    expect(days[0].bar[0].widthPct).toBeCloseTo(100, 5); // 09:00→17:30 fills the span
    expect(days[0].rows.map((r) => r.statusLabel)).toEqual(["No data", "No data"]);
    expect(days[0].rows[0].time).toBe("Morning");
  });
});
