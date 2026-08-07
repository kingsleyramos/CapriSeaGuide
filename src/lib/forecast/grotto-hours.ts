/**
 * Capri's clock and the grotto's opening hours: the one place that answers
 * "what time is it there" and "is the cave open".
 *
 * Everything downstream depends on this agreeing with itself -- the recorder
 * gates writes on it, the segment builder bounds each day's bar with it, the
 * status chip decides off-hours from it, and the client picks its poll cadence
 * from it. Two encodings of the rule would let those drift apart.
 */

import { GROTTO_HOURS, LOCATION, REFRESH } from "@/config/tuning";

const pad = (n: number) => String(n).padStart(2, "0");

/** Capri-local date, month, integer hour, and minutes from midnight. Accepts a
 *  Date or an epoch-ms reading straight out of the store. */
export function capriParts(at: Date | number, timezone: string = LOCATION.timezone) {
  const ms = typeof at === "number" ? at : at.getTime();
  const d = new Date(new Date(ms).toLocaleString("en-US", { timeZone: timezone }));
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    month: d.getMonth(),
    hour: d.getHours(),
    minute: d.getHours() * 60 + d.getMinutes(),
  };
}

/** Seasonal closing hour (24h decimal, e.g. 17.5) for a 0-indexed month. */
export const closeHourForMonth = (month: number): number =>
  (GROTTO_HOURS.summerMonths as readonly number[]).includes(month)
    ? GROTTO_HOURS.summerClose
    : GROTTO_HOURS.winterClose;

/** Open at the opening minute, shut at the closing one. */
export function isWithinGrottoHours(
  at: Date | number,
  timezone: string = LOCATION.timezone,
): boolean {
  const { month, minute } = capriParts(at, timezone);
  return minute >= GROTTO_HOURS.open * 60 && minute < closeHourForMonth(month) * 60;
}

/** How long the client waits before refetching the grotto endpoints. Nothing is
 *  recorded outside opening hours, so there is nothing to poll for. */
export const grottoPollDelayMs = (at: Date | number = Date.now()): number =>
  isWithinGrottoHours(at) ? REFRESH.liveIntervalMs : REFRESH.intervalMs;
