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
import { GROTTO_HOURS, LOCATION } from "@/config/tuning";
import { pct } from "./math";

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

/* --------------------------------------- 7-day history (timeline + grid) */

/** One open/closed segment of a day, with the sea behind it. Produced by the
 *  history route (reported from readings, or estimated from the model). */
export interface HistorySegment {
  startMin: number;
  endMin: number;
  start: string; // "09:00"
  end: string; // "11:30"
  status: "open" | "closed";
  /** Time shown on the bar at this boundary; null for the first segment, and
   *  for every estimated segment (those are guesses at hour resolution). */
  transitionLabel: string | null;
  cells: Record<string, string>;
}
export interface HistoryDayPayload {
  date: string;
  label: string; // "Mon 3 Aug"
  /** "reported" = boatmen's call, "estimated" = forecast, "none" = no data. */
  kind: "reported" | "estimated" | "none";
  segments: HistorySegment[];
}

export interface HistoryBarSegment {
  widthPct: number;
  status: "open" | "closed" | "none";
  label: string | null;
}
export interface HistoryGridRow {
  time: string;
  statusLabel: string;
  statusKind: "open" | "closed";
  cells: Record<string, string>;
}
export interface HistoryDayView {
  date: string;
  label: string;
  kind: "reported" | "estimated" | "none";
  bar: HistoryBarSegment[];
  rows: HistoryGridRow[];
}
export interface HistoryAxisLabel {
  label: string;
  pct: number;
}
export interface HistoryView {
  days: HistoryDayView[];
  axis: HistoryAxisLabel[];
}

const AXIS_MIN = GROTTO_HOURS.open * 60;

/** Seasonal close (minutes from midnight) for a date. */
const closeMinForDate = (date: string) =>
  ((GROTTO_HOURS.summerMonths as readonly number[]).includes(Number(date.slice(5, 7)) - 1)
    ? GROTTO_HOURS.summerClose
    : GROTTO_HOURS.winterClose) * 60;

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Axis ticks from opening to the latest close shown: 09:00, every third hour, then the close. */
function axisLabels(closeMin: number): HistoryAxisLabel[] {
  const span = Math.max(1, closeMin - AXIS_MIN);
  const marks = [AXIS_MIN];
  for (let h = GROTTO_HOURS.open + 3; h * 60 < closeMin; h += 3) marks.push(h * 60);
  marks.push(closeMin);
  return marks.map((m) => ({ label: hhmm(m), pct: ((m - AXIS_MIN) / span) * 100 }));
}

/** Turn the history payload into render models. The scale is the latest close
 *  among the days shown, so each bar fills to its own close and shorter days
 *  render proportionally shorter (rescaling as the window slides). */
export function buildHistoryView(days: HistoryDayPayload[]): HistoryView {
  const C = COPY.grottoHistory;
  const maxCloseMin = days.length
    ? Math.max(...days.map((d) => closeMinForDate(d.date)))
    : GROTTO_HOURS.summerClose * 60;
  const span = Math.max(1, maxCloseMin - AXIS_MIN);
  const widthOf = (fromMin: number, toMin: number) =>
    Math.max(0, ((toMin - fromMin) / span) * 100);

  const views: HistoryDayView[] = days.map((day) => {
    if (day.kind === "none" || !day.segments.length) {
      return {
        date: day.date,
        label: day.label,
        kind: "none",
        bar: [{ widthPct: widthOf(AXIS_MIN, closeMinForDate(day.date)), status: "none", label: null }],
        rows: [],
      };
    }
    return {
      date: day.date,
      label: day.label,
      kind: day.kind,
      bar: day.segments.map((s) => ({
        widthPct: widthOf(s.startMin, s.endMin),
        status: s.status,
        label: s.transitionLabel,
      })),
      rows: day.segments.map((s) => ({
        time: `${s.start}–${s.end}`,
        statusLabel: C.statusWord[s.status],
        statusKind: s.status,
        cells: s.cells,
      })),
    };
  });

  return { days: views, axis: axisLabels(maxCloseMin) };
}
