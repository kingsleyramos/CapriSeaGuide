import { ACTIVITIES, type ActivityKey } from "@/config/activities";
import { CONFIDENCE, FORECAST_DAYS, SLOT_HOURS, SPREAD } from "@/config/tuning";
import { clamp, mean } from "./math";
import { computeProbs, headProb } from "./model";
import type {
  CompactHour,
  DayForecast,
  HourPoint,
  RawHour,
  Slot,
  SlotSourceHour,
  SourceMeta,
} from "./types";

/** Blend multi-model + ensemble disagreement into one kn-equivalent spread. */
function blendSpread(h: RawHour): number {
  const parts =
    SPREAD.windModelStdWeight * (h.windModelStd || 0) +
    SPREAD.windEnsembleStdWeight * (h.windEnsembleStd || 0) +
    SPREAD.waveModelStdToKn * (h.waveModelStd || 0);
  // parts === 0 means no source produced a spread this hour (a single model, or
  // a degraded/missing feed), i.e. no disagreement *signal*, not perfect
  // agreement, which real 51-member ensemble data never yields. Fall back
  // rather than report false certainty.
  if (!Number.isFinite(parts) || parts <= 0) return SPREAD.fallback;
  return Math.max(SPREAD.floor, parts);
}

/** Turn normalized hours into engine hours: add date/hour, pressure tendency,
 *  blended spread, and per-activity probabilities. */
export function buildHours(raw: RawHour[]): HourPoint[] {
  const hours: HourPoint[] = raw.map((h) => ({
    ...h,
    date: h.t.slice(0, 10),
    hour: Number(h.t.slice(11, 13)),
    dp: 0,
    spread: blendSpread(h),
    probs: computeProbs(h),
  }));
  hours.forEach((h, i) => {
    const later = hours[Math.min(hours.length - 1, i + 6)];
    h.dp = later.press - h.press;
  });
  return hours;
}

/** Forecast confidence for a slot (0–1). Docked for lead time, source spread,
 *  pressure change, and sitting near the 50% verdict knife-edge. */
export function confidence(
  { spread, dp, head }: Pick<Slot, "spread" | "dp" | "head">,
  lead: number,
): number {
  const c = CONFIDENCE;
  let conf = c.base - lead * c.leadPenaltyPerDay;
  conf -= clamp(spread / c.spread.divisor, 0, c.spread.max);
  conf -= clamp(
    (Math.abs(dp) - c.pressure.deadband) / c.pressure.divisor,
    0,
    c.pressure.max,
  );
  conf -= (0.5 - Math.abs(head - 0.5)) * c.thresholdWeight;
  return clamp(conf, c.clampMin, c.clampMax);
}

/** Average a set of hours into a single slot. Returns null for an empty slot. */
export function buildSlot(hours: SlotSourceHour[], lead: number): Slot | null {
  if (!hours.length) return null;
  const mid = hours[Math.floor(hours.length / 2)];
  const p = {} as Record<ActivityKey, number>;
  for (const a of ACTIVITIES) p[a.key] = mean(hours.map((h) => h.probs[a.key]));

  const head = headProb(p);
  const spread = mean(hours.map((h) => h.spread));
  const dp = mean(hours.map((h) => h.dp));

  return {
    wave: mean(hours.map((h) => h.wave)),
    swell: mean(hours.map((h) => h.swell)),
    per: mean(hours.map((h) => h.per)),
    wind: mean(hours.map((h) => h.wind)),
    gust: Math.max(...hours.map((h) => h.gust)),
    wDir: mid.wDir,
    dir: mid.dir,
    press: mean(hours.map((h) => h.press)),
    dp,
    spread,
    rain: mean(hours.map((h) => h.rain)),
    p,
    head,
    conf: confidence({ spread, dp, head }, lead),
  };
}

/** Group engine hours into up to `limit` days with AM/PM slots. */
export function buildDays(
  hours: HourPoint[],
  limit: number = FORECAST_DAYS,
): DayForecast[] {
  const dates: string[] = [];
  for (const h of hours) if (!dates.includes(h.date)) dates.push(h.date);

  return dates.slice(0, limit).map((date, lead) => {
    const inDay = hours.filter((h) => h.date === date);
    const inSlot = (slot: readonly number[]) =>
      inDay.filter((h) => slot.includes(h.hour));
    return {
      date,
      lead,
      morning: buildSlot(inSlot(SLOT_HOURS.morning), lead),
      afternoon: buildSlot(inSlot(SLOT_HOURS.afternoon), lead),
    };
  });
}

const toCompact = (h: HourPoint): CompactHour => ({
  t: h.t,
  date: h.date,
  hour: h.hour,
  wave: h.wave,
  swell: h.swell,
  per: h.per,
  wDir: h.wDir,
  wind: h.wind,
  dir: h.dir,
  gust: h.gust,
  press: h.press,
  rain: h.rain,
  dp: h.dp,
  spread: h.spread,
  probs: h.probs,
});

/** Build the numeric report the API returns (no display strings). */
export function buildReport(
  raw: RawHour[],
  meta: SourceMeta,
  fetchedAt: number,
  timezone: string,
) {
  const hours = buildHours(raw);
  return {
    fetchedAt,
    timezone,
    hours: hours.map(toCompact),
    days: buildDays(hours),
    meta,
  };
}
