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

/** One open/closed segment of a recorded day, with the sea behind it.
 *  Produced by the history route; rendered as a bar chunk + a grid row. */
export interface HistorySegment {
  startMin: number;
  endMin: number;
  start: string; // "9:00"
  end: string; // "11:30"
  status: "open" | "closed";
  /** Time shown on the bar at this boundary; null for the first segment. */
  transitionLabel: string | null;
  cells: Record<string, string>;
}
/** A modeled AM/PM slot, shown when the recorder has no data for the day. */
export interface HistoryModeledSlot {
  label: string;
  pct: string;
  tone: PillTone;
  cells: Record<string, string>;
}
export interface HistoryDayPayload {
  date: string;
  label: string; // "Mon 3 Aug"
  /** Recorded segments, or null when nothing was logged for the day. */
  segments: HistorySegment[] | null;
  modeled: HistoryModeledSlot[];
}

export interface HistoryBarSegment {
  widthPct: number;
  kind: "open" | "closed" | "modeled";
  label: string | null;
}
export interface HistoryGridRow {
  time: string;
  statusLabel: string;
  statusKind: "open" | "closed" | "modeled";
  tone: PillTone | null;
  cells: Record<string, string>;
}
export interface HistoryDayView {
  date: string;
  label: string;
  recorded: boolean;
  bar: HistoryBarSegment[];
  rows: HistoryGridRow[];
}

/** Shared axis: 9am to 6pm (equal 3-hour steps). Bars fill their real opening
 *  hours within it, so shorter winter days simply end earlier on the same scale. */
const AXIS_MIN = 9 * 60;
const AXIS_SPAN = 9 * 60;

const closeMinForDate = (date: string) =>
  ((GROTTO_HOURS.summerMonths as readonly number[]).includes(Number(date.slice(5, 7)) - 1)
    ? GROTTO_HOURS.summerClose
    : GROTTO_HOURS.winterClose) * 60;

const widthOf = (fromMin: number, toMin: number) =>
  Math.max(0, ((toMin - fromMin) / AXIS_SPAN) * 100);

/** Turn the history payload into render models: a timeline bar per day plus the
 *  expandable grid behind it (recorded segments, or the modeled fallback). */
export function buildHistoryView(days: HistoryDayPayload[]): HistoryDayView[] {
  const C = COPY.grottoHistory;
  return days.map((day) => {
    if (day.segments && day.segments.length) {
      return {
        date: day.date,
        label: day.label,
        recorded: true,
        bar: day.segments.map((s) => ({
          widthPct: widthOf(s.startMin, s.endMin),
          kind: s.status,
          label: s.transitionLabel,
        })),
        rows: day.segments.map((s) => ({
          time: `${s.start}–${s.end}`,
          statusLabel: C.statusWord[s.status],
          statusKind: s.status,
          tone: null,
          cells: s.cells,
        })),
      };
    }
    return {
      date: day.date,
      label: day.label,
      recorded: false,
      bar: [{ widthPct: widthOf(AXIS_MIN, closeMinForDate(day.date)), kind: "modeled", label: null }],
      rows: day.modeled.map((m) => ({
        time: m.label,
        statusLabel: m.pct,
        statusKind: "modeled" as const,
        tone: m.tone,
        cells: m.cells,
      })),
    };
  });
}
