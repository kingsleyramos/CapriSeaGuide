/**
 * Live Blue Grotto status, resolved for display.
 *
 * capri.net gives a *daily weather verdict* (open / closed / unknown), not a
 * real-time signal. So we combine it with the Capri-local clock: outside
 * opening hours the grotto is simply closed for the day (not a weather
 * closure), and inside hours the verdict applies. When the verdict is
 * unreadable during hours, we fall back to our own forecast odds.
 */

import { COPY, type GrottoDisplayTone, type GrottoStatus } from "@/config/copy";
import { GROTTO_HOURS, LOCATION, type PillTone } from "@/config/tuning";
import type { ActualSlotStatus } from "./grotto-actual";
import { compass, pct } from "./math";
import { pillTone } from "./model";
import type { DayForecast, Slot } from "./types";

export interface GrottoView {
  label: string;
  tone: GrottoDisplayTone;
  line: string;
}

/** Capri-local hour (decimal) and month, for opening-hours checks. */
function capriParts(now: Date, timezone: string) {
  const wall = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return { hour: wall.getHours() + wall.getMinutes() / 60, month: wall.getMonth() };
}

/** Seasonal closing hour (24h decimal) for a given 0-indexed month. */
export function grottoCloseHour(month: number): number {
  return (GROTTO_HOURS.summerMonths as readonly number[]).includes(month)
    ? GROTTO_HOURS.summerClose
    : GROTTO_HOURS.winterClose;
}

export function isWithinGrottoHours(now: Date, timezone: string = LOCATION.timezone): boolean {
  const { hour, month } = capriParts(now, timezone);
  return hour >= GROTTO_HOURS.open && hour < grottoCloseHour(month);
}

export function buildGrottoView({
  verdict,
  conflict,
  now,
  timezone = LOCATION.timezone,
  forecastGrottoProb,
}: {
  /** capri.net's daily weather verdict. */
  verdict: GrottoStatus;
  conflict: boolean;
  now: Date;
  timezone?: string;
  /** Our modeled grotto closure probability for the current hour (0-1). */
  forecastGrottoProb: number;
}): GrottoView {
  const c = COPY.grottoBar;
  const { hour, month } = capriParts(now, timezone);
  const within = hour >= GROTTO_HOURS.open && hour < grottoCloseHour(month);

  // Outside opening hours: closed because it is off-hours, regardless of the
  // day's weather verdict. This is the truthful state at, say, 9pm.
  if (!within) {
    const beforeOpen = hour < GROTTO_HOURS.open;
    return {
      label: c.statusLabel.offHours,
      tone: "offHours",
      line: beforeOpen ? c.line.offHoursBeforeOpen : c.line.offHoursAfterClose,
    };
  }

  if (conflict) {
    return { label: c.statusLabel.closed, tone: "closed", line: c.disagreement };
  }
  if (verdict === "open") {
    return { label: c.statusLabel.open, tone: "open", line: c.line.open };
  }
  if (verdict === "closed") {
    return { label: c.statusLabel.closed, tone: "closed", line: c.line.weatherClosed };
  }
  // Unknown during hours: fall back to our own forecast odds.
  return {
    label: c.statusLabel.unknown,
    tone: "unknown",
    line: c.fallback(pct(forecastGrottoProb)),
  };
}

/* ------------------------------------------- 7-day history (model hindcast) */

/** A recorded intra-day change, with the sea conditions behind it. */
export interface HistoryTransition {
  time: string; // "11:30" Capri-local
  to: "open" | "closed";
  wave: number | null; // m
  wind: number | null; // kt
  from: string | null; // compass bearing
}
export interface HistoryActual {
  am: ActualSlotStatus;
  pm: ActualSlotStatus;
  transitions: HistoryTransition[];
}
/** A history day = the model day plus the recorded status (null until logged). */
export type HistoryDay = DayForecast & { actual: HistoryActual | null };

export interface HistoryCell {
  pctText: string;
  tone: PillTone | "none";
}
export interface HistoryNumber {
  label: string;
  value: string;
}
export interface HistoryRow {
  date: string;
  label: string;
  am: HistoryCell;
  pm: HistoryCell;
  numbers: HistoryNumber[];
  /** Recorded AM/PM status text, null when nothing was logged for the day. */
  reported: { am: string; pm: string } | null;
  /** Recorded intra-day changes, pre-formatted (e.g. "Closed ~11:30 · waves 1.2 m NW, 22 kt"). */
  changes: string[] | null;
}

const historyCell = (slot: Slot | null): HistoryCell =>
  slot
    ? { pctText: pct(slot.p.grotto), tone: pillTone(slot.p.grotto) }
    : { pctText: "—", tone: "none" };

const historyLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** Turn past DayForecasts into history rows: the modeled grotto odds per
 *  AM/PM slot, plus the sea report behind them. */
export function buildGrottoHistory(days: HistoryDay[]): HistoryRow[] {
  const C = COPY.grottoHistory;
  const L = C.numberLabels;
  const statusText = (s: ActualSlotStatus) => (s ? C.statusWord[s] : C.statusWord.none);

  return days.map((day) => {
    const pair = (f: (s: Slot) => string) =>
      `${day.am ? f(day.am) : "—"} / ${day.pm ? f(day.pm) : "—"}`;
    const actual = day.actual;
    return {
      date: day.date,
      label: historyLabel(day.date),
      am: historyCell(day.am),
      pm: historyCell(day.pm),
      numbers: [
        { label: L.waves, value: pair((x) => `${x.wave.toFixed(1)} m`) },
        { label: L.swell, value: pair((x) => `${x.swell.toFixed(1)} m`) },
        { label: L.from, value: pair((x) => compass(x.wDir)) },
        { label: L.wind, value: pair((x) => `${Math.round(x.wind)} kt ${compass(x.dir)}`) },
      ],
      reported: actual ? { am: statusText(actual.am), pm: statusText(actual.pm) } : null,
      changes: actual
        ? actual.transitions.map((tr) => {
            const sea =
              tr.wave != null && tr.wind != null && tr.from
                ? ` · waves ${tr.wave} m ${tr.from}, ${tr.wind} kt`
                : "";
            return `${C.transitionWord[tr.to]} ~${tr.time}${sea}`;
          })
        : null,
    };
  });
}
