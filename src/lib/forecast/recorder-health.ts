import { GROTTO_HOURS, LOCATION } from "@/config/tuning";
import { capriParts } from "./grotto-hours";
import type { GrottoReading } from "./types";

/**
 * Whether the recorder has stopped producing usable readings. The failure is
 * silent by nature -- a parser that falls through to "unknown" still stores a
 * row and answers 200 -- and readings cannot be backfilled.
 */

/** Hours into the open day after which silence is a fault, not a slow start. */
export const RECORDER_GRACE_HOURS = 2;

export const pastRecorderGrace = (now: Date, timezone: string = LOCATION.timezone): boolean =>
  capriParts(now, timezone).minute >= (GROTTO_HOURS.open + RECORDER_GRACE_HOURS) * 60;

/** True when not one of today's readings carries a definitive status. */
export const noUsableReading = (readings: GrottoReading[]): boolean =>
  !readings.some((r) => r.status !== "unknown");
