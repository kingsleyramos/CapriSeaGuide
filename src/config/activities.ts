/**
 * The sea activities we forecast, and the physical thresholds at which each
 * one closes or is cancelled.
 *
 * Every activity has its own breaking point. A standard activity closes on a
 * blend of wave height and wind (a logistic curve for each). Some are
 * direction-sensitive: `faceBearing` is the compass bearing (degrees, in the
 * meteorological "coming from" convention) that the activity is most exposed
 * to. A swell arriving from that bearing hits hardest. `null` means the
 * activity is effectively omnidirectional.
 *
 * The Blue Grotto has bespoke physics (its mouth is barely a metre high and it
 * faces NW), so its tuning lives in `GROTTO` in ./tuning and it is not given a
 * `model` block here.
 *
 * These numbers are the designer's calibration. Change them here. Nothing in
 * the engine hard-codes an activity threshold.
 *
 * `waveMid` is anchored to the Douglas sea scale -- the vocabulary the
 * Capitaneria and the Italian press use ("mare forza 4"):
 *
 *   Douglas 3, Slight    0.50-1.25 m
 *   Douglas 4, Moderate  1.25-2.50 m
 *   Douglas 5, Rough     2.50-4.00 m
 *
 * Each `waveMid` is the height at which that activity is a coin flip:
 *
 *   kayak 0.60, grottos 0.62   low Slight -- small craft and a low cave mouth
 *   swim 0.85, faraglioni 0.95 mid Slight
 *   tour 1.15                  top of Slight, just under Moderate
 *   fPos 1.35, charter 1.40    entering Moderate; the Amalfi run is exposed
 *   fSor 1.85, fNap 2.00       mid Moderate, matching Italian reporting that
 *                              hydrofoils stop around 1.5-2 m
 *   fBig 2.70                  entering Rough: car ferries run through Moderate
 *
 * `waveK` (curve steepness) is not sourced: it claims how well we know the
 * midpoint, not anything about the sea. Judgement until the archive can score it.
 */

export type ActivityKey =
  | "grotto"
  | "tour"
  | "grottos"
  | "faraglioni"
  | "charter"
  | "kayak"
  | "swim"
  | "fSor"
  | "fNap"
  | "fPos"
  | "fBig";

export interface ActivityModel {
  /** Wave height (m) at the midpoint of the closure curve. */
  waveMid: number;
  /** Wave-curve steepness (m). Smaller = sharper transition. */
  waveK: number;
  /** Wind speed (kn) at the midpoint of the closure curve. */
  windMid: number;
  /** Wind-curve steepness (kn). */
  windK: number;
  /** Exposure bearing (deg, "coming from") for direction sensitivity, or null. */
  faceBearing: number | null;
  /** Minimum probability floor. Nothing is ever 0% off. */
  floor: number;
}

export interface ActivityDef {
  key: ActivityKey;
  /** Human label shown in the UI. */
  name: string;
  /** Standard closure model. Absent for the Blue Grotto (bespoke, see GROTTO). */
  model?: ActivityModel;
}

/**
 * Order matters: this is the order rows appear in the day-detail table, and the
 * first three (grotto, tour, grottos) are the "top" activities surfaced on the
 * Today cards.
 */
export const ACTIVITIES: readonly ActivityDef[] = [
  { key: "grotto", name: "Blue Grotto entry" },
  { key: "tour", name: "Island boat tour", model: { waveMid: 1.15, waveK: 0.2, windMid: 18.5, windK: 3, faceBearing: null, floor: 0.03 } },
  { key: "grottos", name: "White & Green grottos", model: { waveMid: 0.62, waveK: 0.13, windMid: 16, windK: 3, faceBearing: null, floor: 0.05 } },
  { key: "faraglioni", name: "Faraglioni swim stop", model: { waveMid: 0.95, waveK: 0.18, windMid: 17, windK: 3, faceBearing: 150, floor: 0.03 } },
  { key: "charter", name: "Private charter", model: { waveMid: 1.4, waveK: 0.24, windMid: 21, windK: 3.4, faceBearing: null, floor: 0.03 } },
  { key: "kayak", name: "Kayak / SUP", model: { waveMid: 0.6, waveK: 0.15, windMid: 14, windK: 2.8, faceBearing: null, floor: 0.04 } },
  { key: "swim", name: "Swim, Marina Piccola", model: { waveMid: 0.85, waveK: 0.2, windMid: 18, windK: 3.6, faceBearing: 195, floor: 0.02 } },
  { key: "fSor", name: "Hydrofoil from Sorrento", model: { waveMid: 1.85, waveK: 0.3, windMid: 26, windK: 4, faceBearing: null, floor: 0.02 } },
  { key: "fNap", name: "Hydrofoil from Naples", model: { waveMid: 2.0, waveK: 0.32, windMid: 27, windK: 4, faceBearing: null, floor: 0.02 } },
  { key: "fPos", name: "Ferry, Positano / Amalfi", model: { waveMid: 1.35, waveK: 0.26, windMid: 21, windK: 3.6, faceBearing: null, floor: 0.04 } },
  { key: "fBig", name: "Car ferry, Naples", model: { waveMid: 2.7, waveK: 0.4, windMid: 34, windK: 5, faceBearing: null, floor: 0.01 } },
] as const;

/** The three activities shown on the Today (morning/afternoon) cards, in order.
 *  Kept as a literal tuple so its copy labels stay exhaustively typed. */
export const TODAY_TOP_ACTIVITIES = ["grotto", "tour", "grottos"] as const;
export type TodayTopKey = (typeof TODAY_TOP_ACTIVITIES)[number];

export const ACTIVITY_BY_KEY: Record<ActivityKey, ActivityDef> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.key, a]),
) as Record<ActivityKey, ActivityDef>;
