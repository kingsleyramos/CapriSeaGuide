import { NextResponse, type NextRequest } from "next/server";
import { publicMessage } from "@/lib/errors";
import { loadReport } from "@/lib/forecast/load";

/**
 * Dynamic, not ISR: `export const revalidate` caches in Next with a one-year
 * expiry, so a quiet site serves the first visitor whatever the last one left
 * and only then queues the regeneration that the *next* visitor gets. The
 * header below bounds staleness instead.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // A dynamic route's CDN key includes the query string, so `?x=1`, `?x=2`, …
  // would each miss the edge and cost an upstream fetch. This route takes none.
  if (new URL(req.url).search) {
    return NextResponse.json({ error: "This endpoint takes no parameters." }, { status: 400 });
  }
  try {
    const report = await loadReport();
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
