import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { publicMessage } from "@/lib/errors";
import { isWithinGrottoHours } from "@/lib/forecast/grotto-hours";
import { fetchGrottoStatus } from "@/lib/sources/grotto";
import { isStoreConfigured, recordReading } from "@/lib/store/grotto-log";

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
    const live = await fetchGrottoStatus({ fresh: true });
    await recordReading({ t: now.getTime(), status: live.status });
    return NextResponse.json({ recorded: live.status, at: now.getTime() });
  } catch (error) {
    return NextResponse.json(
      { error: publicMessage(error, "poll failed") },
      { status: 500 },
    );
  }
}
