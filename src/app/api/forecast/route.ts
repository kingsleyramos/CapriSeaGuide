import { NextResponse, type NextRequest } from "next/server";
import { LOCATION } from "@/config/tuning";
import { PublicError, publicMessage } from "@/lib/errors";
import { buildReport } from "@/lib/forecast/aggregate";
import { fetchSources } from "@/lib/sources/open-meteo";

/**
 * Dynamic, not ISR. `export const revalidate` puts this in Next's own cache,
 * whose Expire is a year: on a quiet site the first visitor of the day is served
 * however old the last entry is -- 400 min was observed -- and only *then* is a
 * regeneration queued, so the refresh lands for the next visitor rather than
 * this one. The CDN honours the header below instead, which bounds staleness to
 * s-maxage + stale-while-revalidate.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // A dynamic route's CDN key includes the query string, so `?x=1`, `?x=2`, …
  // would each miss the edge and cost an upstream fetch. This route takes none.
  if (new URL(req.url).search) {
    return NextResponse.json({ error: "This endpoint takes no parameters." }, { status: 400 });
  }
  try {
    const { raw, meta } = await fetchSources();
    if (!raw.length) throw new PublicError("The forecast service returned no data.");
    // fetchedAt is this response's generation time. The upstream Open-Meteo
    // fetches have their own hourly Data Cache, so the served data can be
    // slightly older than this stamp: "Updated …" means "assembled at", not
    // "sensor time". The two caches share a 1h window and stay ~in lockstep.
    const report = buildReport(raw, meta, Date.now(), LOCATION.timezone);
    return NextResponse.json(report, {
      headers: {
        // 5 min of grace, not 30: the page promises an hourly refresh, and the
        // grace period is added to the age a reader can actually be shown.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: publicMessage(error, "Failed to load the forecast.") },
      { status: 502 },
    );
  }
}
