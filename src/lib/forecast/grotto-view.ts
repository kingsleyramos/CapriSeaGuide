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

/* ------------------------------------- grotto timeline (today bar + history) */

/** A reported (solid) tone, or a forecast (pale) tone. Forecast tones only ever
 *  appear on the live day's bar, never on the past. */
export type SegmentTone = "open" | "closed" | "expectedOpen" | "possibleClosure";
/** A bar run's fill: a segment tone, or "none" for a no-data (grey) day. */
export type BarTone = SegmentTone | "none";

/** One run of a timeline bar. The route sizes runs in minutes; the view turns
 *  those into widths against the shared scale. */
export interface BarSegment {
  startMin: number;
  endMin: number;
  tone: BarTone;
  /** Time shown on the bar at a reported transition; null otherwise. */
  label: string | null;
}

/** One row of an expanded history day's grid: a reported open/closed run (with
 *  the sea at that change) or a morning/afternoon slot average on a no-data day. */
export interface HistoryRow {
  time: string; // "11:30–17:30", or "Morning" / "Afternoon"
  statusLabel: string; // "Open" / "Closed" / "No data"
  tone: BarTone;
  cells: Record<string, string>;
}

/** The live day: reported so far (solid), then forecast to close (pale). */
export interface TodayPayload {
  date: string;
  label: string; // "Today" | "Tomorrow"
  bar: BarSegment[];
  /** Reported/forecast divider (minutes from midnight); null when all forecast. */
  lastCheckMin: number | null;
  lastCheckLabel: string | null; // "13:00"
}

export interface HistoryDayPayload {
  date: string;
  label: string; // "Mon 3 Aug"
  /** "reported" = boatmen's calls; "none" = no recorded status (sea stats only). */
  kind: "reported" | "none";
  bar: BarSegment[];
  rows: HistoryRow[];
}

/** The payload the history route returns and the hook fetches. */
export interface GrottoTimelinePayload {
  today: TodayPayload | null;
  days: HistoryDayPayload[];
}

export interface TimelineBarSegment {
  widthPct: number;
  tone: BarTone;
  label: string | null;
}
export interface TodayView {
  date: string;
  label: string;
  bar: TimelineBarSegment[];
  /** Position (%) of the reported/forecast divider; null when all forecast. */
  dividerPct: number | null;
  dividerLabel: string | null; // "reported as of 13:00"
}
export interface HistoryDayView {
  date: string;
  label: string;
  kind: "reported" | "none";
  bar: TimelineBarSegment[];
  rows: HistoryRow[];
}
export interface HistoryAxisLabel {
  label: string;
  pct: number;
}
export interface GrottoTimelineView {
  today: TodayView | null;
  days: HistoryDayView[];
  axis: HistoryAxisLabel[];
}

const AXIS_MIN = GROTTO_HOURS.open * 60;

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Seasonal close (minutes from midnight) for a date. */
const closeMinForDate = (date: string) =>
  ((GROTTO_HOURS.summerMonths as readonly number[]).includes(Number(date.slice(5, 7)) - 1)
    ? GROTTO_HOURS.summerClose
    : GROTTO_HOURS.winterClose) * 60;

/** Axis ticks from opening to the latest close shown: 09:00, every third hour, then the close. */
function axisLabels(closeMin: number): HistoryAxisLabel[] {
  const span = Math.max(1, closeMin - AXIS_MIN);
  const marks = [AXIS_MIN];
  for (let h = GROTTO_HOURS.open + 3; h * 60 < closeMin; h += 3) marks.push(h * 60);
  marks.push(closeMin);
  return marks.map((m) => ({ label: hhmm(m), pct: ((m - AXIS_MIN) / span) * 100 }));
}

/**
 * Turn the timeline payload into what the component renders. Every bar is drawn
 * against one shared scale: the latest closing time among the days shown. So
 * each bar fills right up to its own close, a shorter winter day looks
 * proportionally shorter, and the scale re-fits as older days drop off the end.
 * Grid rows are already formatted by the route, so they pass straight through.
 */
export function buildGrottoTimeline(payload: GrottoTimelinePayload): GrottoTimelineView {
  const C = COPY.grottoHistory;
  const dates = [
    ...(payload.today ? [payload.today.date] : []),
    ...payload.days.map((d) => d.date),
  ];
  const maxCloseMin = dates.length
    ? Math.max(...dates.map(closeMinForDate))
    : GROTTO_HOURS.summerClose * 60;
  const span = Math.max(1, maxCloseMin - AXIS_MIN);
  const widthOf = (fromMin: number, toMin: number) =>
    Math.max(0, ((toMin - fromMin) / span) * 100);

  const toBar = (segs: BarSegment[]): TimelineBarSegment[] =>
    segs.map((s) => ({ widthPct: widthOf(s.startMin, s.endMin), tone: s.tone, label: s.label }));

  const today: TodayView | null = payload.today
    ? {
        date: payload.today.date,
        label: payload.today.label,
        bar: toBar(payload.today.bar),
        dividerPct:
          payload.today.lastCheckMin != null
            ? widthOf(AXIS_MIN, payload.today.lastCheckMin)
            : null,
        dividerLabel:
          payload.today.lastCheckLabel != null
            ? C.reportedAsOf(payload.today.lastCheckLabel)
            : null,
      }
    : null;

  const days: HistoryDayView[] = payload.days.map((day) => ({
    date: day.date,
    label: day.label,
    kind: day.kind,
    bar: toBar(day.bar),
    rows: day.rows,
  }));

  return { today, days, axis: axisLabels(maxCloseMin) };
}
