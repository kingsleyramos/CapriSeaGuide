import { NextResponse, type NextRequest } from "next/server";
import { isWithinGrottoHours } from "@/lib/forecast/grotto-hours";
import type { GrottoLive } from "@/lib/forecast/types";
import { fetchGrottoStatus } from "@/lib/sources/grotto";
import { readLatestReading } from "@/lib/store/grotto-log";

/** Dynamic for the same reason as /api/forecast: Next's ISR cache serves stale
 *  entries for up to a year, so the CDN header has to be the thing that bounds
 *  how old a reader's copy can be. */
export const dynamic = "force-dynamic";

/** How far back a stored reading still counts as "now". The recorder writes
 *  every 10 min, so anything older than this means it has stopped. */
const FRESH_WINDOW_MS = 45 * 60_000;

export async function GET(req: NextRequest) {
  if (new URL(req.url).search) {
    return NextResponse.json({ error: "This endpoint takes no parameters." }, { status: 400 });
  }

  // Reading the recorder's row instead of scraping is what keeps this endpoint
  // and the timeline from describing the same cave differently.
  const now = Date.now();
  const recorded = await readLatestReading(now - FRESH_WINDOW_MS, now);

  const live: GrottoLive = recorded
    ? {
        status: recorded.status,
        sources: [],
        conflict: recorded.conflict ?? false,
        checkedAt: recorded.t,
      }
    : isWithinGrottoHours(now)
      ? // Fallback so a deployment without a configured store still works.
        await fetchGrottoStatus()
      : // Shut for the day: the card renders off-hours from the clock regardless,
        // so a scrape here spends someone else's bandwidth on an unread value.
        { status: "unknown", sources: [], conflict: false, checkedAt: now };

  return NextResponse.json(live, {
    headers: {
      // Short: the value changes on the recorder's 10-min cadence, and a store
      // read is cheap enough to serve it that fresh.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
    },
  });
}
