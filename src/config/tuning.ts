/**
 * Every numeric knob in the forecast model, in one place.
 *
 * The engine imports these; it hard-codes nothing. If you want to re-tune the
 * forecast (make the grotto more cautious, change what counts as "Calm",
 * weight the ensemble differently), do it here.
 *
 * See ./activities for the per-activity closure thresholds and ./copy for all
 * the wording.
 */

import type { ActivityKey } from "./activities";

/** Geographic points. The marine model is sampled just NW of the island where
 *  the open-sea swell is cleanest; wind/pressure at the island itself. */
export const LOCATION = {
  marine: { lat: 40.585, lon: 14.155 },
  island: { lat: 40.5532, lon: 14.2222 },
  timezone: "Europe/Rome",
} as const;

/** Which local hours count as "morning" and "afternoon" slots. */
export const SLOT_HOURS = {
  morning: [9, 10, 11, 12],
  afternoon: [13, 14, 15, 16, 17],
} as const;

export const FORECAST_DAYS = 7;

/**
 * Forecast sources. Confidence is derived from how much these disagree, so the
 * more (independent) models here, the better calibrated confidence becomes.
 *  - `weatherModels`: deterministic NWP models for wind / gusts / pressure.
 *  - `ensembleModel` + members: probabilistic spread for wind / pressure.
 *  - `waveModels`: deterministic wave models (Open-Meteo has no wave ensemble).
 */
export const SOURCES = {
  weatherModels: [
    "ecmwf_ifs025",
    "gfs_seamless",
    "icon_seamless",
    "gem_seamless",
    "meteofrance_seamless",
    "ukmo_seamless",
  ],
  ensembleModel: "ecmwf_ifs025",
  waveModels: ["ecmwf_wam025", "gwam", "meteofrance_wave", "ncep_gfswave025"],
} as const;

/**
 * Direction model. `cosFace` returns a 0.22–1.0 exposure factor for how
 * head-on a swell/wind from `dir` hits a shore facing `faceBearing`.
 *
 * `legacyInverted` reproduces the delivered design's bug, where the factor
 * peaked for a swell arriving from the *opposite* bearing (so SE swell
 * "closed" the NW-facing grotto). Left here as a switch for exact reproduction;
 * the corrected default matches the design's own prose and Open-Meteo's
 * documented "coming from" direction convention.
 */
export const DIRECTION = {
  legacyInverted: false,
  /** Floor of the exposure factor for a fully off-axis direction. */
  floor: 0.22,
} as const;

/** Blue Grotto: bespoke physics (barely-a-metre-high mouth, faces NW). */
export const GROTTO = {
  faceBearing: 322,
  period: { clampMin: 3, clampMax: 14, ref: 6, exp: 0.35 },
  swell: { effMid: 0.34, effK: 0.062 },
  wind: { mid: 17, k: 3.2, weight: 0.85 },
  /** Extra long-period swell surge term. */
  longPeriodSurge: { periodMin: 8, faceMin: 0.7, waveMid: 0.3, waveK: 0.09, weight: 0.5 },
  floor: 0.04,
  ceil: 0.985,
} as const;

/**
 * Blue Grotto opening hours (Capri local time), used to tell a weather closure
 * apart from "it is simply outside opening hours". Seasonal and approximate;
 * capri.net notes hours "may vary". `open`/`close` are 24h decimal hours.
 * Summer (Apr–Oct): 09:00 to 17:30. Winter (Nov–Mar): 09:00 to 14:00.
 */
export const GROTTO_HOURS = {
  open: 9,
  summerClose: 17.5,
  winterClose: 14,
  /** 0-indexed months Apr..Oct. */
  summerMonths: [3, 4, 5, 6, 7, 8, 9],
} as const;

/** How many past days the Blue Grotto history shows. */
export const HISTORY_DAYS = 7;

/** How many past days of recorded live status the recorder keeps. We store 30
 *  but show HISTORY_DAYS; bump HISTORY_DAYS later to surface the rest. */
export const RETENTION_DAYS = 30;

/**
 * Bands for the grotto's forecast, i.e. the pale part of the live day's bar:
 * today's hours after the last recorded check, and all of tomorrow once today
 * has closed. For each hour, a modelled closure chance at or above
 * `possibleClosureAt` shows as "possible closure"; below it, "expected open".
 * We reuse the PILL_BANDS "low" cutoff (0.3) so this pale bar and the activity
 * pill can never tell different stories. Past days are never forecast this way:
 * with no recorded call they simply read "No data".
 */
export const GROTTO_FORECAST = { possibleClosureAt: 0.3 } as const;

/** Gust term added to every standard activity's closure probability. */
export const GUST = { midOffset: 8, kOffset: 1, weight: 0.6 } as const;

/** Ceiling applied to standard (non-grotto) activity probabilities. */
export const ACTIVITY_CEIL = 0.99;

/**
 * The single headline probability that drives the verdict chips is a weighted
 * blend of the plans that break first.
 */
export const HEAD_WEIGHTS: Partial<Record<ActivityKey, number>> = {
  grotto: 0.62,
  tour: 0.38,
};

/** Verdict chip bands, by headline probability (chance sea plans are off). */
export type VerdictTone = "calm" | "good" | "uncertain" | "likelyOff" | "off";
export const VERDICT_BANDS: { max: number; tone: VerdictTone }[] = [
  { max: 0.13, tone: "calm" },
  { max: 0.3, tone: "good" },
  { max: 0.5, tone: "uncertain" },
  { max: 0.72, tone: "likelyOff" },
  { max: Infinity, tone: "off" },
];

/** Per-activity "chance it's off" pill bands. */
export type PillTone = "low" | "mid" | "high";
export const PILL_BANDS: { max: number; tone: PillTone }[] = [
  { max: 0.3, tone: "low" },
  { max: 0.6, tone: "mid" },
  { max: Infinity, tone: "high" },
];

/** "Now" card background tint bands, by headline probability. */
export type NowTone = "calm" | "uncertain" | "off";
export const NOW_TINT_BANDS: { max: number; tone: NowTone }[] = [
  { max: 0.3, tone: "calm" },
  { max: 0.5, tone: "uncertain" },
  { max: Infinity, tone: "off" },
];

/**
 * Confidence model. Starts high and is docked for: lead time, source
 * disagreement (`spread`), fast-changing pressure, and sitting near a verdict
 * threshold. It describes the forecast's certainty, never how open something is.
 */
export const CONFIDENCE = {
  base: 0.94,
  leadPenaltyPerDay: 0.075,
  spread: { divisor: 14, max: 0.3 },
  pressure: { deadband: 2, divisor: 14, max: 0.22 },
  /** Penalty for sitting near the 50% knife-edge. */
  thresholdWeight: 0.42,
  clampMin: 0.12,
  clampMax: 0.96,
  /** Band cutoffs for the High / Medium / Low label. */
  highAbove: 0.72,
  mediumAbove: 0.46,
  /** Beyond this lead day, sub-high confidence gets the "this far out" wording. */
  farLeadDay: 4,
} as const;

/**
 * How the multi-model + ensemble disagreement is folded into a single
 * `spread` value (kn-equivalent) for the confidence model. This is the
 * enrichment over the original two-model design: instead of |ECMWF − GFS|,
 * spread now blends cross-model wind std, ECMWF ensemble std, and cross-model
 * wave std.
 */
export const SPREAD = {
  windModelStdWeight: 1.4,
  windEnsembleStdWeight: 0.8,
  /** Wave-height std (m) → kn-equivalent. */
  waveModelStdToKn: 6,
  floor: 1,
  /** Used when a source is missing for an hour (mirrors the original default). */
  fallback: 2.5,
} as const;

/** How far ahead (ms) a re-fetch is triggered when the tab regains focus. */
export const REFRESH = {
  intervalMs: 3_600_000, // hourly
  staleAfterMs: 1_800_000, // 30 min
  clockTickMs: 60_000,
  /** "(n min ago)" only shows once the data is at least this old. */
  agoThresholdMin: 3,
} as const;

/** Compass bearing → 16-point label; also used by direction-set membership tests. */
export const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

/** Compass points treated as "northerly" for the grotto summaries. */
export const NORTHERLY_SAILOR = ["N", "NNE", "NNW", "NW", "WNW", "NE"] as const;
/** Compass points that close the grotto, for the per-day "why" line. */
export const GROTTO_CLOSING_DIRS = ["N", "NNW", "NW", "WNW", "NNE"] as const;

/** Model-disagreement threshold (kn) above which the "why" line warns about wind. */
export const WHY_SPREAD_WARN = 5;
/** Pressure fall (hPa over the slot) below which the "why" line warns of worsening. */
export const WHY_PRESSURE_WARN = -3;
/** Head-probability gap between AM and PM that flips the "turns worse/better" note. */
export const SLOT_DELTA_NOTE = 0.12;

/** Pressure-tendency (hPa change to +6h) bands for the "pattern" line on the Now card. */
export const PATTERN_BANDS = {
  fallingFast: -4,
  easing: -1.5,
  building: 2,
} as const;
