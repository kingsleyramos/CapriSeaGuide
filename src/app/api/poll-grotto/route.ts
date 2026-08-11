import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { publicMessage } from "@/lib/errors";
import { capriParts, isWithinGrottoHours } from "@/lib/forecast/grotto-hours";
import { loadReport } from "@/lib/forecast/load";
import { MODEL_VERSION } from "@/lib/forecast/model-version";
import { noUsableReading, pastRecorderGrace } from "@/lib/forecast/recorder-health";
import type { GrottoLive } from "@/lib/forecast/types";
import { fetchGrottoStatus } from "@/lib/sources/grotto";
import {
  isStoreConfigured,
  recordObservation,
  recordReading,
  readReadings,
} from "@/lib/store/grotto-log";

/** Never cached: each call records a fresh reading. */
export const dynamic = "force-dynamic";

/** Constant-time compare: `!==` short-circuits on the first differing byte.
 *  timingSafeEqual throws on unequal lengths, hence the length check first
 *  (leaks the secret's length, never its contents). */
function authorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Records one live Blue Grotto reading. Called every 10 min during opening
 * hours by an Upstash QStash schedule. It self-gates to opening hours anyway,
 * so a call that drifts past a boundary just no-ops cheaply.
 *
 * Protect it by setting POLL_SECRET (also on the schedule). Locally
 * the store is inert so a missing secret is fine; but once the store is
 * configured (a real deployment), a missing secret fails closed rather than
 * silently leaving the endpoint open to anonymous callers.
 */
export async function POST(req: Request) {
  const secret = process.env.POLL_SECRET;
  // Fail closed on real deployments: a configured store in production or preview
  // (Vercel runs both as NODE_ENV=production) must carry its secret, so a
  // rotation slip or dropped env errors loudly instead of downgrading the
  // endpoint to open. Local dev is exempt, so pulling the store's env vars
  // without the Sensitive POLL_SECRET still works.
  if (isStoreConfigured() && process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (secret && !authorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!isWithinGrottoHours(now)) {
    return NextResponse.json({ skipped: "outside opening hours" });
  }
  if (!isStoreConfigured()) {
    return NextResponse.json({ skipped: "store not configured" });
  }

  try {
    const live = await fetchGrottoStatus();
    await recordReading({ t: now.getTime(), status: live.status, conflict: live.conflict });
    await archive(now, live);

    // A broken scraper returns "unknown" forever and still answers 200, so a 500
    // is the only thing the scheduler will surface. Gated on a whole silent
    // morning, so a single bad scrape stays quiet.
    if (live.status === "unknown" && (await noUsableReadingToday(now))) {
      return NextResponse.json(
        { error: "no open/closed reading recorded today; the sources may have changed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ recorded: live.status, at: now.getTime() });
  } catch (error) {
    return NextResponse.json(
      { error: publicMessage(error, "poll failed") },
      { status: 500 },
    );
  }
}

/** True when the cave has been open a while and nothing definitive has landed.
 *  Time check first, so a healthy poll never reads the store. */
async function noUsableReadingToday(now: Date): Promise<boolean> {
  if (!pastRecorderGrace(now)) return false;
  const { minute } = capriParts(now);
  const startOfDay = now.getTime() - minute * 60_000;
  return noUsableReading(await readReadings(startOfDay, now.getTime()));
}

/** Best-effort: the archive is research data, and losing a row must never cost
 *  a reading on the timeline. */
async function archive(now: Date, live: GrottoLive): Promise<void> {
  try {
    const report = await loadReport();
    const { date, hour } = capriParts(now);
    const h = report.hours.find((x) => x.date === date && x.hour === hour);
    if (!h) return;
    await recordObservation({
      t: now.getTime(),
      status: live.status,
      conflict: live.conflict,
      predicted: h.probs.grotto,
      model: MODEL_VERSION,
      inputs: {
        wave: h.wave,
        swell: h.swell,
        per: h.per,
        wDir: h.wDir,
        wind: h.wind,
        dir: h.dir,
        gust: h.gust,
        press: h.press,
      },
    });
  } catch {
    /* research data, not a request path */
  }
}
