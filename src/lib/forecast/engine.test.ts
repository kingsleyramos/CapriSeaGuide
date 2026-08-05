import { describe, expect, it } from "vitest";
import type { RawHour } from "./types";
import {
  angleDelta,
  clamp,
  compass,
  cosFace,
  logistic,
  orProb,
  pct,
  std,
} from "./math";
import {
  buildDays,
  buildHours,
  buildReport,
  confidence,
} from "./aggregate";
import {
  computeProbs,
  confidenceTone,
  grottoProb,
  headProb,
  patternBand,
  pillTone,
  verdictTone,
} from "./model";
import { buildDayRow, buildTodayCards, pickCurrentHour, verdictOrDash } from "./view";

/* ------------------------------------------------------------------ helpers */

const baseHour = (over: Partial<RawHour> = {}): RawHour => ({
  t: "2026-08-03T09:00",
  wind: 8,
  dir: 200,
  gust: 12,
  press: 1015,
  rain: 0,
  windModelStd: 1,
  windEnsembleStd: 1,
  wave: 0.4,
  swell: 0.3,
  per: 5,
  wDir: 200,
  waveModelStd: 0.05,
  ...over,
});

/** A calm day and a rough NW-swell day, 24 hours each. */
function syntheticRaw(): RawHour[] {
  const hours: RawHour[] = [];
  for (let d = 0; d < 2; d++) {
    for (let h = 0; h < 24; h++) {
      const date = d === 0 ? "2026-08-03" : "2026-08-04";
      const t = `${date}T${String(h).padStart(2, "0")}:00`;
      hours.push(
        d === 0
          ? baseHour({ t, wave: 0.3, wind: 6, wDir: 200, dir: 200 })
          : baseHour({ t, wave: 1.6, wind: 24, wDir: 322, dir: 322, per: 9, gust: 33 }),
      );
    }
  }
  return hours;
}

/* -------------------------------------------------------------------- math */

describe("math primitives", () => {
  it("logistic crosses 0.5 at the midpoint", () => {
    expect(logistic(10, 10, 3)).toBeCloseTo(0.5, 6);
    expect(logistic(16, 10, 3)).toBeGreaterThan(0.8);
    expect(logistic(4, 10, 3)).toBeLessThan(0.2);
  });

  it("clamp / orProb / pct", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(orProb(0.5, 0.5)).toBeCloseTo(0.75, 6);
    expect(pct(0.384)).toBe("38%");
  });

  it("angleDelta is symmetric and 0..180", () => {
    expect(angleDelta(10, 350)).toBe(20);
    expect(angleDelta(0, 180)).toBe(180);
    expect(angleDelta(322, 322)).toBe(0);
  });

  it("compass maps cardinal bearings", () => {
    expect(compass(0)).toBe("N");
    expect(compass(90)).toBe("E");
    expect(compass(322)).toBe("NW");
  });

  it("std of identical values is 0", () => {
    expect(std([5, 5, 5])).toBe(0);
    expect(std([0, 10])).toBeCloseTo(5, 6);
  });
});

/* ------------------------------------------------ the direction-physics fix */

describe("cosFace direction physics (fixed, not inverted)", () => {
  it("peaks when the incoming direction matches the exposed bearing", () => {
    expect(cosFace(322, 322)).toBeCloseTo(1, 6); // NW swell on NW-facing grotto
    expect(cosFace(142, 322)).toBeCloseTo(0.22, 2); // SE swell barely reaches it
  });

  it("a southerly hits the south-facing swim beach (195) hardest", () => {
    expect(cosFace(195, 195)).toBeGreaterThan(cosFace(15, 195));
  });
});

describe("grottoProb honours the fix", () => {
  it("NW swell closes the grotto far more than an equal SE swell", () => {
    const nw = grottoProb({ wave: 1.2, swell: 1, per: 9, wDir: 322, wind: 12, dir: 322, gust: 18 });
    const se = grottoProb({ wave: 1.2, swell: 1, per: 9, wDir: 142, wind: 12, dir: 142, gust: 18 });
    expect(nw).toBeGreaterThan(0.8);
    // The head-on NW swell is near-certain; the off-axis SE swell is much lower.
    expect(nw - se).toBeGreaterThan(0.4);
  });

  it("stays inside its configured floor/ceil", () => {
    const calm = grottoProb({ wave: 0.05, swell: 0, per: 4, wDir: 180, wind: 2, dir: 180, gust: 3 });
    const storm = grottoProb({ wave: 4, swell: 3, per: 12, wDir: 322, wind: 45, dir: 322, gust: 60 });
    expect(calm).toBeGreaterThanOrEqual(0.04);
    expect(storm).toBeLessThanOrEqual(0.985);
  });
});

/* ----------------------------------------------------------- activity model */

describe("computeProbs across activities", () => {
  const rough = { wave: 1.5, swell: 1.2, per: 8, wDir: 322, wind: 22, dir: 322, gust: 30 };
  it("hydrofoils cancel before the big car ferry", () => {
    const p = computeProbs(rough);
    expect(p.fSor).toBeGreaterThan(p.fBig);
  });
  it("kayak is more fragile than a private charter", () => {
    const p = computeProbs(rough);
    expect(p.kayak).toBeGreaterThan(p.charter);
  });
  it("headProb sits between its grotto and tour inputs", () => {
    const p = computeProbs(rough);
    const head = headProb(p);
    const lo = Math.min(p.grotto, p.tour);
    const hi = Math.max(p.grotto, p.tour);
    expect(head).toBeGreaterThanOrEqual(lo - 1e-9);
    expect(head).toBeLessThanOrEqual(hi + 1e-9);
  });
});

/* ---------------------------------------------------------------- verdicts */

describe("tone bands", () => {
  it("verdict bands", () => {
    expect(verdictTone(0.05)).toBe("calm");
    expect(verdictTone(0.2)).toBe("good");
    expect(verdictTone(0.4)).toBe("uncertain");
    expect(verdictTone(0.6)).toBe("likelyOff");
    expect(verdictTone(0.9)).toBe("off");
  });
  it("pill bands", () => {
    expect(pillTone(0.1)).toBe("low");
    expect(pillTone(0.45)).toBe("mid");
    expect(pillTone(0.8)).toBe("high");
  });
  it("confidence + pattern bands", () => {
    expect(confidenceTone(0.9)).toBe("high");
    expect(confidenceTone(0.5)).toBe("medium");
    expect(confidenceTone(0.2)).toBe("low");
    expect(patternBand(-6)).toBe("fallingFast");
    expect(patternBand(0)).toBe("steady");
    expect(patternBand(5)).toBe("building");
  });
});

/* --------------------------------------------------------------- confidence */

describe("confidence model", () => {
  it("drops with lead time and with source disagreement", () => {
    const near = confidence({ spread: 2, dp: 0, head: 0.2 }, 0);
    const far = confidence({ spread: 2, dp: 0, head: 0.2 }, 5);
    const agree = confidence({ spread: 1, dp: 0, head: 0.2 }, 1);
    const disagree = confidence({ spread: 25, dp: 0, head: 0.2 }, 1);
    expect(near).toBeGreaterThan(far);
    expect(agree).toBeGreaterThan(disagree);
  });
  it("stays within clamp bounds", () => {
    const c = confidence({ spread: 999, dp: -50, head: 0.5 }, 6);
    expect(c).toBeGreaterThanOrEqual(0.12);
    expect(c).toBeLessThanOrEqual(0.96);
  });
});

/* --------------------------------------------------------------- aggregation */

describe("aggregation", () => {
  const hours = buildHours(syntheticRaw());

  it("adds derived fields to every hour", () => {
    expect(hours).toHaveLength(48);
    expect(hours[0].date).toBe("2026-08-03");
    expect(hours[0].hour).toBe(0);
    expect(hours[0].probs.grotto).toBeGreaterThan(0);
    expect(hours[0].spread).toBeGreaterThan(0);
  });

  it("groups into days with AM and PM slots", () => {
    const days = buildDays(hours);
    expect(days).toHaveLength(2);
    expect(days[0].morning).not.toBeNull();
    expect(days[0].afternoon).not.toBeNull();
    expect(days[0].lead).toBe(0);
  });

  it("the rough NW day reads far worse than the calm day", () => {
    const days = buildDays(hours);
    expect(days[1].morning!.head).toBeGreaterThan(days[0].morning!.head + 0.4);
    expect(days[0].morning!.head).toBeLessThan(0.2);
  });

  it("buildReport yields a compact, serializable payload", () => {
    const r = buildReport(
      syntheticRaw(),
      { weatherModels: ["a"], ensembleModel: "b", ensembleMembers: 51, waveModels: ["c"] },
      1_700_000_000_000,
      "Europe/Rome",
    );
    expect(r.hours[0]).not.toHaveProperty("windModelStd");
    expect(r.hours[0]).toHaveProperty("rain");
    expect(JSON.parse(JSON.stringify(r)).days).toHaveLength(2);
  });
});

/* --------------------------------------------------------------------- view */

describe("view models", () => {
  const days = buildDays(buildHours(syntheticRaw()));
  const report = buildReport(
    syntheticRaw(),
    { weatherModels: [], ensembleModel: "", ensembleMembers: 0, waveModels: [] },
    Date.parse("2026-08-03T10:00:00Z"),
    "Europe/Rome",
  );

  const noonCapri = new Date("2026-08-03T10:00:00Z"); // 12:00 Rome (CEST)
  const eveningCapri = new Date("2026-08-03T16:30:00Z"); // 18:30 Rome, after the PM slot

  it("today cards render both halves with copy-driven titles", () => {
    const cards = buildTodayCards(days, noonCapri, "Europe/Rome");
    expect(cards.map((c) => c.key)).toEqual(["morning", "afternoon"]);
    expect(cards[0].title).toBe("This morning");
    expect(cards[0].top).toHaveLength(3);
  });

  it("today cards roll to tomorrow once the afternoon has ended", () => {
    const cards = buildTodayCards(days, eveningCapri, "Europe/Rome");
    expect(cards[0].title).toBe("Tomorrow morning");
    expect(cards[1].title).toBe("Tomorrow afternoon");
  });

  it("today cards skip a stale leading day after midnight", () => {
    const pastMidnight = new Date("2026-08-03T22:30:00Z"); // 00:30 Rome, Aug 4
    const cards = buildTodayCards(days, pastMidnight, "Europe/Rome");
    expect(cards[0].title).toBe("This morning"); // Aug 4 is now today, not tomorrow
  });

  it("verdictOrDash returns a dash for an empty slot", () => {
    expect(verdictOrDash(null)).toEqual({ tone: "none", label: "—" });
  });

  it("day row explains an NW-swell closure and labels Today/Tomorrow", () => {
    const rough = buildDayRow(days[1], noonCapri, "Europe/Rome")!;
    expect(rough.why).toMatch(/closes the Blue Grotto/);
    expect(buildDayRow(days[0], noonCapri, "Europe/Rome")!.label).toMatch(/Today/);
    expect(rough.label).toMatch(/Tomorrow/);
  });

  it("day labels track the client clock, not the report's lead", () => {
    const pastMidnight = new Date("2026-08-03T22:30:00Z"); // 00:30 Rome, Aug 4
    expect(buildDayRow(days[0], pastMidnight, "Europe/Rome")!.label).not.toMatch(/Today/);
    expect(buildDayRow(days[1], pastMidnight, "Europe/Rome")!.label).toMatch(/Today/);
  });

  it("buildDayRow returns null when a day has neither AM nor PM slot", () => {
    expect(
      buildDayRow({ date: "2026-08-03", lead: 0, morning: null, afternoon: null }, noonCapri, "Europe/Rome"),
    ).toBeNull();
  });

  it("pickCurrentHour finds the hour nearest Capri wall-time", () => {
    const noon = new Date("2026-08-03T10:00:00Z"); // 12:00 Rome (CEST)
    const cur = pickCurrentHour(report.hours, noon);
    expect(cur.hour).toBe(12);
  });
});
