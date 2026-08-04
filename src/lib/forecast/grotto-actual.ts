/**
 * Turns the recorder's raw reading series into what the history shows:
 * the actual AM/PM status, and the intra-day open/closed changes with times.
 *
 * Times are at the poll resolution (~30 min). Only readings inside opening
 * hours exist (the poller no-ops otherwise), so a status change between two
 * consecutive readings is a genuine weather-driven flip, not the scheduled
 * daily open/close.
 */

import { LOCATION, SLOT_HOURS } from "@/config/tuning";
import type { GrottoReading } from "./types";

export type ActualSlotStatus = "open" | "closed" | "mixed" | null;

export interface ActualTransition {
  /** Capri-local "HH:MM" of the reading where the new status first appeared. */
  time: string;
  /** Capri-local hour (0-23) of that reading, for pairing with sea conditions. */
  hour: number;
  to: "open" | "closed";
}

export interface ActualDay {
  am: ActualSlotStatus;
  pm: ActualSlotStatus;
  transitions: ActualTransition[];
}

interface Local {
  date: string;
  hour: number; // 0-23
  hhmm: string;
}

function capriLocal(ms: number, timezone: string): Local {
  const d = new Date(new Date(ms).toLocaleString("en-US", { timeZone: timezone }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hour: d.getHours(),
    hhmm: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const summarize = (statuses: string[]): ActualSlotStatus => {
  const defined = statuses.filter((s) => s === "open" || s === "closed");
  if (!defined.length) return null;
  return defined.every((s) => s === defined[0]) ? (defined[0] as "open" | "closed") : "mixed";
};

/** Derive the actual status + intra-day transitions for one Capri-local date. */
export function deriveActualDay(
  readings: GrottoReading[],
  date: string,
  timezone: string = LOCATION.timezone,
): ActualDay {
  const day = readings
    .map((r) => ({ r, l: capriLocal(r.t, timezone) }))
    .filter((x) => x.l.date === date)
    .sort((a, b) => a.r.t - b.r.t);

  const inSlot = (slot: readonly number[]) =>
    day.filter((x) => slot.includes(x.l.hour)).map((x) => x.r.status);

  const transitions: ActualTransition[] = [];
  for (let i = 1; i < day.length; i++) {
    const to = day[i].r.status;
    if (to !== day[i - 1].r.status && (to === "open" || to === "closed")) {
      transitions.push({ time: day[i].l.hhmm, hour: day[i].l.hour, to });
    }
  }

  return {
    am: summarize(inSlot(SLOT_HOURS.am)),
    pm: summarize(inSlot(SLOT_HOURS.pm)),
    transitions,
  };
}
