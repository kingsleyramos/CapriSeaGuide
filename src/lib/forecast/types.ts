import type { ActivityKey } from "@/config/activities";

/**
 * One hour of already-normalized forecast, produced by the source layer.
 * "Central" values are the multi-model consensus; the `*Std` fields carry how
 * much the sources disagreed, which feeds the confidence model.
 */
export interface RawHour {
  /** Local ISO time, e.g. "2026-08-03T09:00". */
  t: string;
  // Atmospheric: consensus
  wind: number; // kn
  dir: number; // deg, coming-from
  gust: number; // kn
  press: number; // hPa
  rain: number; // mm
  // Atmospheric: disagreement
  windModelStd: number; // kn, across deterministic models
  windEnsembleStd: number; // kn, across ensemble members
  // Marine: consensus
  wave: number; // m
  swell: number; // m
  per: number; // s (swell period)
  wDir: number; // deg, coming-from
  waveModelStd: number; // m, across wave models
}

/** A single hour after the engine has added derived fields. */
export interface HourPoint extends RawHour {
  date: string; // "YYYY-MM-DD"
  hour: number; // 0–23 local
  dp: number; // pressure change to +6h (hPa)
  spread: number; // blended source disagreement (kn-equivalent)
  probs: Record<ActivityKey, number>;
}

/** A morning or afternoon slot: averaged conditions + per-activity odds. */
export interface Slot {
  wave: number;
  swell: number;
  per: number;
  wind: number;
  gust: number;
  wDir: number;
  dir: number;
  press: number;
  dp: number;
  spread: number;
  rain: number;
  /** Chance each activity is off, 0–1. */
  p: Record<ActivityKey, number>;
  /** Headline probability driving the verdict chip. */
  head: number;
  /** Forecast confidence, 0–1. */
  conf: number;
}

export interface DayForecast {
  date: string;
  /** Days from today (0 = today). */
  lead: number;
  am: Slot | null;
  pm: Slot | null;
}

/** Compact per-hour payload sent to the client (drops the intermediate std fields). */
export interface CompactHour {
  t: string;
  date: string;
  hour: number;
  wave: number;
  swell: number;
  per: number;
  wDir: number;
  wind: number;
  dir: number;
  gust: number;
  press: number;
  rain: number;
  dp: number;
  spread: number;
  probs: Record<ActivityKey, number>;
}

/** The subset of hour fields a slot average reads, satisfied by both
 *  HourPoint (engine) and CompactHour (client). */
export type SlotSourceHour = Pick<
  HourPoint,
  | "wave"
  | "swell"
  | "per"
  | "wind"
  | "gust"
  | "wDir"
  | "dir"
  | "press"
  | "dp"
  | "spread"
  | "rain"
  | "probs"
>;

export interface SourceMeta {
  weatherModels: string[];
  ensembleModel: string;
  ensembleMembers: number;
  waveModels: string[];
}

/** The full numeric forecast returned by /api/forecast. No display strings;
 *  the client derives those with the view layer so wording stays live. */
export interface ForecastReport {
  fetchedAt: number; // epoch ms, server clock
  timezone: string;
  hours: CompactHour[];
  days: DayForecast[];
  meta: SourceMeta;
}

/** Cross-checked live Blue Grotto status from /api/grotto. */
export interface GrottoLive {
  status: "open" | "closed" | "unknown";
  /** Which sources were readable and what each said. */
  sources: { name: string; status: "open" | "closed" | "unknown" }[];
  /** True when readable sources disagreed. */
  conflict: boolean;
  checkedAt: number;
}
