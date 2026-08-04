import { NextResponse } from "next/server";
import { HISTORY_DAYS } from "@/config/tuning";
import { buildDays, buildHours } from "@/lib/forecast/aggregate";
import { fetchHistory } from "@/lib/sources/open-meteo";

/** History changes slowly; hourly regeneration is plenty. */
export const revalidate = 3600;

export async function GET() {
  try {
    const { raw } = await fetchHistory();
    if (!raw.length) throw new Error("No history is available right now.");
    // fetchHistory returns HISTORY_DAYS past days + today; keep the past days,
    // most recent first.
    const days = buildDays(buildHours(raw), HISTORY_DAYS).reverse();
    return NextResponse.json(
      { days },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
