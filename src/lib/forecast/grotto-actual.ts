/**
 * Turns the recorder's raw reading series into open/closed *segments* for one
 * day: contiguous runs of the same status, spanning opening hours. A day that
 * stayed open is one segment; one that closed and reopened is three; two
 * closures is five. Segment widths are durations, so the timeline handles any
 * number without a ragged grid.
 *
 * Only readings inside opening hours exist (the poller no-ops otherwise), so a
 * status change between consecutive readings is a genuine weather flip, not the
 * scheduled daily open/close. Times are at the poll resolution (~30 min), and
 * the day is bounded by its season's close (see GROTTO_HOURS).
 */

import { GROTTO_HOURS, LOCATION } from "@/config/tuning";
import type { GrottoReading } from "./types";

export interface ActualSegment {
  /** Minutes from midnight (Capri local), for proportional bar widths. */
  startMin: number;
  endMin: number;
  start: string; // "9:00"
  end: string; // "11:30"
  status: "open" | "closed";
  /** Representative Capri-local hour, for pairing with sea conditions. */
  hour: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const minToHHMM = (min: number) => `${Math.floor(min / 60)}:${pad(min % 60)}`;

function capriParts(ms: number, timezone: string) {
  const d = new Date(new Date(ms).toLocaleString("en-US", { timeZone: timezone }));
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hour: d.getHours(),
    minute: d.getHours() * 60 + d.getMinutes(),
  };
}

const closeHourForMonth = (month: number) =>
  (GROTTO_HOURS.summerMonths as readonly number[]).includes(month)
    ? GROTTO_HOURS.summerClose
    : GROTTO_HOURS.winterClose;

/** Merge a day's readings into open/closed segments across opening hours. */
export function deriveSegments(
  readings: GrottoReading[],
  date: string,
  timezone: string = LOCATION.timezone,
): ActualSegment[] {
  const day = readings
    .map((r) => ({ ...capriParts(r.t, timezone), status: r.status, t: r.t }))
    .filter((x) => x.date === date && (x.status === "open" || x.status === "closed"))
    .sort((a, b) => a.t - b.t);
  if (!day.length) return [];

  const month = Number(date.slice(5, 7)) - 1;
  const openMin = GROTTO_HOURS.open * 60;
  const closeMin = closeHourForMonth(month) * 60;

  // Collapse consecutive same-status readings into runs (the change points).
  const runs: { min: number; hour: number; status: "open" | "closed" }[] = [];
  for (const x of day) {
    const last = runs[runs.length - 1];
    if (last && last.status === x.status) continue;
    runs.push({ min: x.minute, hour: x.hour, status: x.status as "open" | "closed" });
  }

  // The first run is assumed to hold from opening; the last, until close.
  return runs.map((run, i) => {
    const startMin = i === 0 ? openMin : run.min;
    const endMin = i < runs.length - 1 ? runs[i + 1].min : Math.max(closeMin, run.min);
    return {
      startMin,
      endMin,
      start: minToHHMM(startMin),
      end: minToHHMM(endMin),
      status: run.status,
      hour: i === 0 ? GROTTO_HOURS.open : run.hour,
    };
  });
}
