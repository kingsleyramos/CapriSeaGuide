import { NextResponse } from "next/server";
import { isWithinGrottoHours } from "@/lib/forecast/grotto-view";
import { fetchGrottoStatus } from "@/lib/sources/grotto";
import { isStoreConfigured, recordReading } from "@/lib/store/grotto-log";

/** Never cached: each call records a fresh reading. */
export const dynamic = "force-dynamic";

/**
 * Records one live Blue Grotto reading. Called by the scheduler (a GitHub
 * Actions cron) every 30 min. It self-gates to opening hours, so a fixed
 * schedule that fires slightly outside hours just no-ops cheaply.
 *
 * Protect it by setting POLL_SECRET (also as the GitHub Actions secret). If
 * POLL_SECRET is unset the check is skipped, which is fine locally.
 */
export async function POST(req: Request) {
  const secret = process.env.POLL_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
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
    const message = error instanceof Error ? error.message : "poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
