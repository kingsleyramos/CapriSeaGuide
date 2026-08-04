import {
  ACTIVITIES,
  type ActivityKey,
  type ActivityModel,
} from "@/config/activities";
import {
  ACTIVITY_CEIL,
  CONFIDENCE,
  GROTTO,
  GUST,
  HEAD_WEIGHTS,
  NOW_TINT_BANDS,
  PATTERN_BANDS,
  PILL_BANDS,
  VERDICT_BANDS,
  type NowTone,
  type PillTone,
  type VerdictTone,
} from "@/config/tuning";
import type { ConfidenceTone, PatternBand } from "@/config/copy";
import { clamp, cosFace, logistic, orProb } from "./math";

/** Inputs a probability calculation needs from one hour. */
export interface ProbInputs {
  wave: number;
  swell: number;
  per: number;
  wDir: number;
  wind: number;
  dir: number;
  gust: number;
}

/** Chance the Blue Grotto entry is off, given one hour of conditions. */
export function grottoProb(h: ProbInputs): number {
  const g = GROTTO;
  const per = clamp(h.per, g.period.clampMin, g.period.clampMax);
  const perFactor = Math.pow(per / g.period.ref, g.period.exp);
  const swellFace = cosFace(h.wDir, g.faceBearing);
  const windFace = cosFace(h.dir, g.faceBearing);

  const effectiveSwell = h.wave * swellFace * perFactor;
  let p = logistic(effectiveSwell, g.swell.effMid, g.swell.effK);
  p = orProb(p, logistic(h.wind * windFace, g.wind.mid, g.wind.k) * g.wind.weight);

  const surge = g.longPeriodSurge;
  if (per >= surge.periodMin && swellFace > surge.faceMin) {
    p = orProb(p, logistic(h.wave, surge.waveMid, surge.waveK) * surge.weight);
  }
  return clamp(p, g.floor, g.ceil);
}

/** Chance a standard (non-grotto) activity is off. */
export function standardProb(h: ProbInputs, m: ActivityModel): number {
  const face = m.faceBearing == null ? 1 : cosFace(h.wDir, m.faceBearing);
  const effectiveWave = h.wave * face;
  let p = orProb(
    logistic(effectiveWave, m.waveMid, m.waveK),
    logistic(h.wind, m.windMid, m.windK),
  );
  p = orProb(
    p,
    logistic(h.gust, m.windMid + GUST.midOffset, m.windK + GUST.kOffset) *
      GUST.weight,
  );
  return clamp(p, m.floor, ACTIVITY_CEIL);
}

/** Chance-off for every activity for one hour. */
export function computeProbs(h: ProbInputs): Record<ActivityKey, number> {
  const out = {} as Record<ActivityKey, number>;
  for (const a of ACTIVITIES) {
    out[a.key] = a.key === "grotto" ? grottoProb(h) : standardProb(h, a.model!);
  }
  return out;
}

/** Weighted headline probability that drives the verdict chip. */
export function headProb(p: Record<ActivityKey, number>): number {
  let sum = 0;
  for (const [key, weight] of Object.entries(HEAD_WEIGHTS)) {
    sum += (p[key as ActivityKey] ?? 0) * (weight ?? 0);
  }
  return sum;
}

const bandTone = <T,>(bands: { max: number; tone: T }[], value: number): T =>
  bands.find((b) => value < b.max)!.tone;

export const verdictTone = (head: number): VerdictTone =>
  bandTone(VERDICT_BANDS, head);
export const pillTone = (p: number): PillTone => bandTone(PILL_BANDS, p);
export const nowTintTone = (head: number): NowTone => bandTone(NOW_TINT_BANDS, head);

/** Map a confidence value to its High / Medium / Low tone. */
export const confidenceTone = (conf: number): ConfidenceTone =>
  conf > CONFIDENCE.highAbove
    ? "high"
    : conf > CONFIDENCE.mediumAbove
      ? "medium"
      : "low";

/** True when a low/medium day is far enough out for the "this far out" wording. */
export const isFarLead = (lead: number, conf: number) =>
  lead >= CONFIDENCE.farLeadDay && conf <= CONFIDENCE.highAbove;

/** Which pressure-tendency sentence applies. */
export const patternBand = (dp: number): PatternBand =>
  dp < PATTERN_BANDS.fallingFast
    ? "fallingFast"
    : dp < PATTERN_BANDS.easing
      ? "easing"
      : dp > PATTERN_BANDS.building
        ? "building"
        : "steady";
