import { COMPASS_POINTS, DIRECTION } from "@/config/tuning";

/** Logistic curve: 0→1 as x passes `mid`, steepness set by `k`. */
export const logistic = (x: number, mid: number, k: number) =>
  1 / (1 + Math.exp(-(x - mid) / k));

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Probability that A or B happens, treating them as independent. */
export const orProb = (a: number, b: number) => 1 - (1 - a) * (1 - b);

export const mean = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

/** Population standard deviation. */
export const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};

/** Smallest angular distance between two compass bearings, 0–180°. */
export const angleDelta = (a: number, b: number) =>
  Math.abs((((a - b) % 360) + 540) % 360 - 180);

/**
 * Exposure factor (DIRECTION.floor–1.0) for how head-on a swell/wind arriving
 * from `dir` hits a shore facing `faceBearing`. Peaks (1.0) when the incoming
 * direction matches the exposed bearing, floors when it is off-axis.
 *
 * `DIRECTION.legacyInverted` restores the delivered design's inverted behavior.
 */
export const cosFace = (dir: number, faceBearing: number) => {
  const d = angleDelta(dir, faceBearing);
  const angle = DIRECTION.legacyInverted ? 180 - d : d;
  return (
    DIRECTION.floor +
    (1 - DIRECTION.floor) * Math.max(0, Math.cos((angle * Math.PI) / 180))
  );
};

/** 16-point compass label for a bearing in degrees. */
export const compass = (d: number) =>
  COMPASS_POINTS[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];

/** Format a 0–1 probability as a whole-percent string, e.g. "38%". */
export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** First non-null value, else fallback. */
export const firstNum = (
  values: (number | null | undefined)[],
  fallback: number,
) => {
  for (const v of values) if (v != null && Number.isFinite(v)) return v;
  return fallback;
};
