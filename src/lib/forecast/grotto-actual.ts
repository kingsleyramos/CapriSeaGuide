/**
 * Turns the recorder's list of readings into open/closed *segments* for one day
 * (a segment is a stretch of time with the same status). A day that stayed open
 * is one segment; one that closed and reopened is three; a second closure makes
 * five. A segment's width is simply how long it lasted, so the bar can show any
 * number of these stretches.
 *
 * The poller only runs during opening hours, so every reading falls inside them.
 * That means a status change from one reading to the next is a real weather flip,
 * not the normal daily open/close. Readings arrive every 10 minutes, so a
 * boundary drawn here is accurate to within one poll -- the change is recorded
 * when we looked, not when it happened. Each day is capped at its season's
 * closing time (see GROTTO_HOURS).
 */

import { GROTTO_FORECAST, GROTTO_HOURS, LOCATION } from "@/config/tuning";
import { capriParts, closeHourForMonth } from "./grotto-hours";
import type { GrottoReading } from "./types";

/** Reported (solid) segment status. */
export type ReportedStatus = "open" | "closed";
/** Forecast (pale) segment tone. */
export type ModeledTone = "expectedOpen" | "possibleClosure";

export interface ActualSegment {
  /** Minutes from midnight (Capri local), for proportional bar widths. */
  startMin: number;
  endMin: number;
  start: string; // "09:00"
  end: string; // "11:30"
  status: ReportedStatus;
  /** Representative Capri-local hour, for pairing with sea conditions. */
  hour: number;
}

export interface ModeledSegment {
  startMin: number;
  endMin: number;
  start: string;
  end: string;
  tone: ModeledTone;
  hour: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const minToHHMM = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/**
 * Merge a day's readings into open/closed segments across opening hours. The
 * last run normally holds until the season's close; pass `dayEndMin` to bound it
 * earlier instead, e.g. the *today* bar ends its reported run at the last check,
 * handing the rest of the day to the forecast.
 */
export function deriveSegments(
  readings: GrottoReading[],
  date: string,
  timezone: string = LOCATION.timezone,
  dayEndMin?: number,
): ActualSegment[] {
  const day = readings
    .map((r) => ({ ...capriParts(r.t, timezone), status: r.status, t: r.t }))
    .filter((x) => x.date === date && (x.status === "open" || x.status === "closed"))
    .sort((a, b) => a.t - b.t);
  if (!day.length) return [];

  const month = Number(date.slice(5, 7)) - 1;
  const openMin = GROTTO_HOURS.open * 60;
  const endBound = dayEndMin ?? closeHourForMonth(month) * 60;

  // Collapse consecutive same-status readings into runs (the change points).
  const runs: { min: number; hour: number; status: ReportedStatus }[] = [];
  for (const x of day) {
    const last = runs[runs.length - 1];
    if (last && last.status === x.status) continue;
    runs.push({ min: x.minute, hour: x.hour, status: x.status as ReportedStatus });
  }

  // The first run is assumed to hold from opening; the last, until the bound.
  return runs
    .map((run, i) => {
      const startMin = i === 0 ? openMin : run.min;
      const endMin = i < runs.length - 1 ? runs[i + 1].min : Math.max(endBound, run.min);
      return {
        startMin,
        endMin,
        start: minToHHMM(startMin),
        end: minToHHMM(endMin),
        status: run.status,
        hour: i === 0 ? GROTTO_HOURS.open : run.hour,
      };
    })
    .filter((s) => s.endMin > s.startMin);
}

const modeledTone = (grotto: number): ModeledTone =>
  grotto >= GROTTO_FORECAST.possibleClosureAt ? "possibleClosure" : "expectedOpen";

/**
 * Build the pale forecast bars for the live day from the model's hourly closure
 * odds. Used for today's hours after the last recorded check, and for all of
 * tomorrow once today has closed. Each hour becomes "expected open" or "possible
 * closure" using the GROTTO_FORECAST cutoff. `fromMin` lets the forecast begin
 * partway through the day (at the last-check time); it defaults to opening time.
 */
export function modeledSegments(
  dayHours: { hour: number; grotto: number }[],
  date: string,
  opts: { fromMin?: number } = {},
): ModeledSegment[] {
  const month = Number(date.slice(5, 7)) - 1;
  const openHour = GROTTO_HOURS.open;
  const closeHour = closeHourForMonth(month);
  const closeMin = closeHour * 60;
  const fromMin = Math.max(openHour * 60, opts.fromMin ?? openHour * 60);
  if (fromMin >= closeMin) return [];

  const startHour = Math.floor(fromMin / 60);
  const inHours = dayHours
    .filter((h) => h.hour >= startHour && h.hour < closeHour)
    .sort((a, b) => a.hour - b.hour);
  if (!inHours.length) return [];

  const runs: { hour: number; tone: ModeledTone }[] = [];
  for (const h of inHours) {
    const tone = modeledTone(h.grotto);
    const last = runs[runs.length - 1];
    if (last && last.tone === tone) continue;
    runs.push({ hour: h.hour, tone });
  }

  return runs
    .map((run, i) => {
      const startMin = i === 0 ? fromMin : run.hour * 60;
      const endMin = i < runs.length - 1 ? runs[i + 1].hour * 60 : closeMin;
      return {
        startMin,
        endMin,
        start: minToHHMM(startMin),
        end: minToHHMM(endMin),
        tone: run.tone,
        hour: run.hour,
      };
    })
    .filter((s) => s.endMin > s.startMin);
}
