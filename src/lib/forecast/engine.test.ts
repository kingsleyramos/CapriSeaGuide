import { describe, expect, it } from "vitest";
import { GROTTO, GROTTO_FORECAST } from "@/config/tuning";
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
    // north: 0 on both, so this stays a test of the swell's direction alone.
    const nw = grottoProb({ wave: 1.2, swell: 1, per: 9, wDir: 322, wind: 12, dir: 322, gust: 18, north: 0, springTide: -1 });
    const se = grottoProb({ wave: 1.2, swell: 1, per: 9, wDir: 142, wind: 12, dir: 142, gust: 18, north: 0, springTide: -1 });
    expect(nw).toBeGreaterThan(0.8);
    // The head-on NW swell is near-certain; the off-axis SE swell is much lower.
    expect(nw - se).toBeGreaterThan(0.4);
  });

  it("stays inside its configured floor/ceil", () => {
    const calm = grottoProb({ wave: 0.05, swell: 0, per: 4, wDir: 180, wind: 2, dir: 180, gust: 3, north: -2, springTide: -1 });
    const storm = grottoProb({ wave: 4, swell: 3, per: 12, wDir: 322, wind: 45, dir: 322, gust: 60, north: 35, springTide: -1 });
    expect(calm).toBe(GROTTO.floor);
    expect(storm).toBe(GROTTO.ceil);
  });
});

describe("northerly wind closes the grotto on its own", () => {
  // 14 Sep 2026: leftover SE swell, light NNE wind, shut at every reading.
  const flat = { wave: 0.23, swell: 0.19, per: 3.6, wDir: 131, wind: 4.6, dir: 20, gust: 6.7, springTide: -1 };

  it("warns in a sea the swell term calls flat", () => {
    expect(grottoProb({ ...flat, north: -4 })).toBe(GROTTO.floor);
    expect(grottoProb({ ...flat, north: 4.5 })).toBeGreaterThan(0.8);
  });

  it("is silent in calm air and in a southerly, however strong", () => {
    for (const north of [0, -3, -12]) expect(grottoProb({ ...flat, north })).toBe(GROTTO.floor);
  });

  it("rises with the wind and never lowers what the swell already says", () => {
    const at = (north: number) => grottoProb({ ...flat, north });
    expect(at(2)).toBeLessThan(at(3));
    expect(at(3)).toBeLessThan(at(5));
    const swell = { wave: 1.2, swell: 1, per: 9, wDir: 322, wind: 6, dir: 180, gust: 9, springTide: -1 };
    expect(grottoProb({ ...swell, north: -6 })).toBeGreaterThan(0.8);
  });

  it("answers to the wind that has been blowing, not the gust of the moment", () => {
    const day = (dirs: number[]) =>
      buildHours(dirs.map((dir, h) => baseHour({ t: `2026-08-03T${String(h).padStart(2, "0")}:00`, wind: 6, dir })));
    const { windowH, mid } = GROTTO.northWind;
    // Six hours from due north: the trailing mean is the wind itself.
    const steady = day(Array(12).fill(0));
    expect(steady[11].north).toBeCloseTo(6, 6);
    expect(steady[0].north).toBeCloseTo(6, 6); // a feed's first hour averages what there is
    // One northerly hour after a southerly morning barely registers...
    const veer = day([...Array(11).fill(180), 0]);
    expect(veer[11].north).toBeLessThan(mid);
    expect(veer[10].north).toBeCloseTo(-6, 6);
    // ...and the term has faded a full window after the wind backs south.
    const back = day([...Array(6).fill(0), ...Array(windowH).fill(180)]);
    expect(back[5].north).toBeCloseTo(6, 6);
    expect(back[6 + windowH - 1].north).toBeCloseTo(-6, 6);
    expect(back[6 + windowH - 1].probs.grotto).toBe(GROTTO.floor);
    expect(steady[11].probs.grotto).toBeGreaterThan(0.8);
  });

  it("is a bearing, not a fixed compass point", () => {
    // A westerly has no northerly component at all; NW has ~0.7 of its speed.
    const [w] = buildHours([baseHour({ wind: 10, dir: 270 })]);
    const [nw] = buildHours([baseHour({ wind: 10, dir: 315 })]);
    expect(w.north).toBeCloseTo(0, 6);
    expect(nw.north).toBeCloseTo(10 * Math.SQRT1_2, 6);
  });
});

describe("swell reaches the cave across its open arc", () => {
  const southerly = { wind: 10, dir: 135, gust: 14, north: -7, springTide: -1 };

  it("shuts for a south-westerly swell the head-on factor waves through", () => {
    // 11 Sep 2026: shut all day.
    expect(grottoProb({ ...southerly, wave: 0.94, swell: 0.78, per: 5.4, wDir: 225 })).toBeGreaterThan(0.8);
  });

  it("is not fooled by wind chop of the same height", () => {
    // 25 Aug 2026: open all day.
    expect(grottoProb({ ...southerly, wave: 0.7, swell: 0.15, per: 2.6, wDir: 239 })).toBe(GROTTO.floor);
  });

  it("stops where the island gets in the way, without a cliff edge", () => {
    const from = (wDir: number) => grottoProb({ ...southerly, wave: 0.84, swell: 0.71, per: 5.5, wDir });
    const { fullWithin, noneBeyond } = GROTTO.swell.reach;
    const off = (deg: number) => from(GROTTO.faceBearing - deg);
    expect(off(fullWithin)).toBeGreaterThan(0.8);
    expect(off((fullWithin + noneBeyond) / 2)).toBeLessThan(off(fullWithin));
    expect(off((fullWithin + noneBeyond) / 2)).toBeGreaterThan(off(noneBeyond));
    expect(off(noneBeyond)).toBe(GROTTO.floor);
    expect(from(142)).toBe(GROTTO.floor); // SE: fully behind the island
  });

  it("leaves a head-on swell exactly as it was", () => {
    // Swell is never taller than the sea it is part of, so on the cave's own
    // bearing the straight-in term always wins.
    const nw = { ...southerly, wave: 0.5, per: 5, wDir: GROTTO.faceBearing };
    expect(grottoProb({ ...nw, swell: 0.5 })).toBe(grottoProb({ ...nw, swell: 0 }));
  });
});

describe("spring tides lean the odds", () => {
  const calm = { wave: 0.15, swell: 0.12, per: 3, wDir: 240, wind: 4, dir: 200, gust: 6, north: -3 };

  it("raises a calm day at the peak, but stops short of the warning line", () => {
    const peak = grottoProb({ ...calm, springTide: 1 });
    expect(peak).toBeGreaterThan(GROTTO.floor);
    expect(peak).toBeLessThan(GROTTO_FORECAST.possibleClosureAt);
    expect(grottoProb({ ...calm, springTide: 0 })).toBe(GROTTO.floor);
    expect(grottoProb({ ...calm, springTide: -1 })).toBe(GROTTO.floor);
  });

  it("tips a marginal day over the line", () => {
    const marginal = { ...calm, north: 2 };
    expect(grottoProb({ ...marginal, springTide: -1 })).toBeLessThan(GROTTO_FORECAST.possibleClosureAt);
    expect(grottoProb({ ...marginal, springTide: 1 })).toBeGreaterThan(GROTTO_FORECAST.possibleClosureAt);
  });

  it("is one value per date, peaking the day after a new or full moon", () => {
    const on = (date: string) =>
      buildHours(Array.from({ length: 24 }, (_, h) => baseHour({ t: `${date}T${String(h).padStart(2, "0")}:00` })));
    const day = on("2026-08-13"); // new moon late on the 12th
    expect(new Set(day.map((h) => h.springTide)).size).toBe(1);
    expect(day[0].springTide).toBeGreaterThan(GROTTO.springTide.mid);
    expect(on("2026-08-21")[0].springTide).toBeLessThan(-0.9); // first quarter
  });

  it("says so when it is the reason", () => {
    const hours = Array.from({ length: 24 }, (_, h) =>
      baseHour({ t: `2026-08-13T${String(h).padStart(2, "0")}:00`, wave: 0.15, swell: 0.12, per: 3, wDir: 240, wind: 4, dir: 200 }),
    );
    const row = buildDayRow(buildDays(buildHours(hours))[0], new Date("2026-08-13T10:00:00Z"), "Europe/Rome")!;
    expect(row.line).toMatch(/spring tides/);
    expect(row.why).toMatch(/new or full moon/);
  });
});

/* ----------------------------------------------------------- activity model */

describe("computeProbs across activities", () => {
  const rough = { wave: 1.5, swell: 1.2, per: 8, wDir: 322, wind: 22, dir: 322, gust: 30, north: 17, springTide: -1 };
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

  it("names the wind, not the swell, when a northerly shuts a flat sea", () => {
    // Leftover swell from the SE (away from the cave) under a steady northerly:
    // the wording must not credit the swell direction with keeping it open.
    const windy = Array.from({ length: 24 }, (_, h) =>
      baseHour({ t: `2026-08-03T${String(h).padStart(2, "0")}:00`, wave: 0.2, swell: 0.2, per: 4, wDir: 131, wind: 6, dir: 10 }),
    );
    const row = buildDayRow(buildDays(buildHours(windy))[0], noonCapri, "Europe/Rome")!;
    expect(row.why).toMatch(/Wind from the north/);
    expect(row.line).toMatch(/northerly wind/i);
    // Same sea under a southerly: back to the swell-direction line, no warning.
    const mild = windy.map((h) => ({ ...h, dir: 190 }));
    const calm = buildDayRow(buildDays(buildHours(mild))[0], noonCapri, "Europe/Rome")!;
    expect(calm.why).toMatch(/helps it stay open/);
    expect(calm.line).toMatch(/No weather closures expected/);
  });

  it("does not blame a trace of northerly swell when the wind is the reason", () => {
    const hours = Array.from({ length: 24 }, (_, h) =>
      baseHour({ t: `2026-08-03T${String(h).padStart(2, "0")}:00`, wave: 0.17, swell: 0.17, per: 3, wDir: 15, wind: 6, dir: 10 }),
    );
    const row = buildDayRow(buildDays(buildHours(hours))[0], noonCapri, "Europe/Rome")!;
    expect(row.line).toMatch(/northerly wind/i);
    expect(row.why).toMatch(/Wind from the north/);
  });

  it("does not call a south-westerly swell sheltered", () => {
    // 11 Sep 2026.
    const sw = Array.from({ length: 24 }, (_, h) =>
      baseHour({ t: `2026-08-03T${String(h).padStart(2, "0")}:00`, wave: 0.94, swell: 0.78, per: 5.4, wDir: 225, wind: 6, dir: 135 }),
    );
    const row = buildDayRow(buildDays(buildHours(sw))[0], noonCapri, "Europe/Rome")!;
    expect(row.why).toMatch(/not head-on/);
    expect(row.why).not.toMatch(/helps it stay open/);
    expect(row.line).toMatch(/almost certainly shut/);
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
