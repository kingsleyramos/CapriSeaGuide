/**
 * Append-only log of live Blue Grotto readings, in Upstash Redis (a sorted set
 * keyed by epoch-ms). Provisioned via the Vercel Marketplace, which injects the
 * connection env vars. If those are absent the whole module is inert: writes
 * no-op and reads return [], so the app runs exactly as it does without a store.
 *
 * We store only { time, status } (about 540 entries over 30 days). Sea
 * conditions for any past moment are reconstructed from Open-Meteo, so nothing
 * else needs persisting.
 */

import { RETENTION_DAYS } from "@/config/tuning";
import type { GrottoReading } from "@/lib/forecast/types";

const KEY = "grotto:log";
const DAY_MS = 86_400_000;

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

const memberOf = (r: GrottoReading) => `${r.t}:${r.status}`;

function parseMember(member: string): GrottoReading | null {
  const i = member.indexOf(":");
  if (i < 0) return null;
  const t = Number(member.slice(0, i));
  const status = member.slice(i + 1);
  if (!Number.isFinite(t)) return null;
  if (status !== "open" && status !== "closed" && status !== "unknown") return null;
  return { t, status };
}

/** Append a reading and prune anything older than the retention window. */
export async function recordReading(reading: GrottoReading): Promise<void> {
  if (!isStoreConfigured()) return;
  const cutoff = reading.t - RETENTION_DAYS * DAY_MS;
  await pipeline([
    ["ZADD", KEY, reading.t, memberOf(reading)],
    ["ZREMRANGEBYSCORE", KEY, "-inf", `(${cutoff}`],
  ]);
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
