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
export function buildGrottoHistory(days: DayForecast[]): HistoryRow[] {
  const L = COPY.grottoHistory.numberLabels;
  return days.map((day) => {
    const pair = (f: (s: Slot) => string) =>
      `${day.am ? f(day.am) : "—"} / ${day.pm ? f(day.pm) : "—"}`;
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
    };
  });
}
