import { NextResponse, type NextRequest } from "next/server";
import { fetchGrottoStatus } from "@/lib/sources/grotto";

/** Dynamic for the same reason as /api/forecast: Next's ISR cache serves stale
 *  entries for up to a year, so the CDN header has to be the thing that bounds
 *  how old a reader's copy can be. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (new URL(req.url).search) {
    return NextResponse.json({ error: "This endpoint takes no parameters." }, { status: 400 });
  }
  const live = await fetchGrottoStatus();
  return NextResponse.json(live, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300",
    },
  });
}
