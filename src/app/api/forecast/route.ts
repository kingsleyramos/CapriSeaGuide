import { NextResponse } from "next/server";
import { LOCATION } from "@/config/tuning";
import { PublicError, publicMessage } from "@/lib/errors";
import { buildReport } from "@/lib/forecast/aggregate";
import { fetchSources } from "@/lib/sources/open-meteo";

/** Regenerate at most hourly; matches the page's refresh cadence. */
export const revalidate = 3600;

export async function GET() {
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
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: publicMessage(error, "Failed to load the forecast.") },
      { status: 502 },
    );
  }
}
