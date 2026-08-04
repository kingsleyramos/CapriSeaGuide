import { NextResponse } from "next/server";
import { fetchGrottoStatus } from "@/lib/sources/grotto";

/** The boatmen call it around 9am; a 30-min cache is plenty. */
export const revalidate = 1800;

export async function GET() {
  const live = await fetchGrottoStatus();
  return NextResponse.json(live, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800",
    },
  });
}
