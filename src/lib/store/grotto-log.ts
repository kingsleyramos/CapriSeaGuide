/**
 * Append-only log of live Blue Grotto readings, in Upstash Redis (a sorted set
 * keyed by epoch-ms). Provisioned via the Vercel Marketplace, which injects the
 * connection env vars. If those are absent the whole module is inert: writes
 * no-op and reads return [], so the app runs exactly as it does without a store.
 *
 * Two keys, deliberately separate: `grotto:log` holds the small rows the
 * timeline reads, `grotto:observations` the heavier research rows, so an
 * archive row never slows down the page.
 *
 * Sea conditions are not stored -- Open-Meteo returns them for any past date.
 * The probability we published is not recoverable, which is what the
 * observation rows are for. Nothing expires; the archive is a few MB a year.
 */

import type { GrottoReading } from "@/lib/forecast/types";

const KEY = "grotto:log";
const OBSERVATIONS_KEY = "grotto:observations";

// Vercel's Upstash integration exposes KV_* ; a direct Upstash setup uses UPSTASH_*.
const URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const isStoreConfigured = (): boolean => Boolean(URL && TOKEN);

type Command = (string | number)[];

async function pipeline(commands: Command[]): Promise<unknown[]> {
  const res = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`store error ${res.status}`);
  const json = (await res.json()) as { result: unknown }[];
  return json.map((r) => r.result);
}

const isStatus = (s: unknown): s is GrottoReading["status"] =>
  s === "open" || s === "closed" || s === "unknown";

/** JSON, so a reading can carry more than a status word. Sorted-set members
 *  must be unique, which the embedded timestamp guarantees. */
export const memberOf = (r: GrottoReading) =>
  JSON.stringify({ t: r.t, s: r.status, ...(r.conflict ? { c: 1 } : {}) });

/** The log is append-only, so legacy `"<epoch>:<status>"` rows stay readable
 *  forever. */
export function parseMember(member: string): GrottoReading | null {
  if (member.startsWith("{")) {
    try {
      const o = JSON.parse(member) as { t?: unknown; s?: unknown; c?: unknown };
      if (typeof o.t !== "number" || !Number.isFinite(o.t) || !isStatus(o.s)) return null;
      return { t: o.t, status: o.s, conflict: o.c === 1 };
    } catch {
      return null;
    }
  }
  const i = member.indexOf(":");
  if (i < 0) return null;
  const t = Number(member.slice(0, i));
  const status = member.slice(i + 1);
  if (!Number.isFinite(t) || !isStatus(status)) return null;
  return { t, status };
}

/** Append a reading. The log is never pruned; see the module header. */
export async function recordReading(reading: GrottoReading): Promise<void> {
  if (!isStoreConfigured()) return;
  await pipeline([["ZADD", KEY, reading.t, memberOf(reading)]]);
}

/** Newest reading in [fromMs, toMs], or null. The live chip and the timeline
 *  both read it, so they cannot disagree. */
export async function readLatestReading(
  fromMs: number,
  toMs: number,
): Promise<GrottoReading | null> {
  if (!isStoreConfigured()) return null;
  try {
    const [members] = (await pipeline([
      ["ZREVRANGEBYSCORE", KEY, toMs, fromMs, "LIMIT", 0, 1],
    ])) as [string[]];
    const newest = members?.[0];
    return newest ? parseMember(newest) : null;
  } catch {
    return null;
  }
}

/** Read readings in [fromMs, toMs], oldest first. Resilient: returns [] on any
 *  problem so the history route never breaks because of the store. */
export async function readReadings(fromMs: number, toMs: number): Promise<GrottoReading[]> {
  if (!isStoreConfigured()) return [];
  try {
    const [members] = (await pipeline([["ZRANGEBYSCORE", KEY, fromMs, toMs]])) as [string[]];
    return (members ?? []).map(parseMember).filter((r): r is GrottoReading => r !== null);
  } catch {
    return [];
  }
}

/**
 * One poll: what the boatmen said, what we predicted for that hour, and the
 * inputs behind it. Inputs are stored rather than re-fetched because they
 * capture what the model actually saw, fallbacks included -- a later archive
 * lookup would show clean data and hide a degraded hour.
 */
export interface GrottoObservation {
  t: number;
  status: GrottoReading["status"];
  conflict: boolean;
  /** Modelled closure chance for that hour, 0-1. */
  predicted: number;
  /** Fingerprint of the constants that produced `predicted`. */
  model: string;
  inputs: {
    wave: number;
    swell: number;
    per: number;
    wDir: number;
    wind: number;
    dir: number;
    gust: number;
    press: number;
  };
}

/** Append one observation. Never pruned; see the module header. */
export async function recordObservation(o: GrottoObservation): Promise<void> {
  if (!isStoreConfigured()) return;
  await pipeline([["ZADD", OBSERVATIONS_KEY, o.t, JSON.stringify(o)]]);
}

/** Observations in [fromMs, toMs], oldest first. Returns [] on any problem: the
 *  archive must never break a request path. */
export async function readObservations(
  fromMs: number,
  toMs: number,
): Promise<GrottoObservation[]> {
  if (!isStoreConfigured()) return [];
  try {
    const [members] = (await pipeline([
      ["ZRANGEBYSCORE", OBSERVATIONS_KEY, fromMs, toMs],
    ])) as [string[]];
    return (members ?? []).flatMap((m) => {
      try {
        return [JSON.parse(m) as GrottoObservation];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
