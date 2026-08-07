import { LOCATION } from "@/config/tuning";
import { PublicError } from "@/lib/errors";
import { fetchSources } from "@/lib/sources/open-meteo";
import { buildReport } from "./aggregate";
import type { ForecastReport } from "./types";

/**
 * The assembled forecast. Shared by /api/forecast and the server-rendered page
 * so the HTML and the client's first refresh cannot describe different weather.
 *
 * fetchedAt is this call's time, not the sensors': the Open-Meteo fetches have
 * their own hourly Data Cache, so the data can be slightly older than the stamp.
 * "Updated ..." means "assembled at".
 */
export async function loadReport(): Promise<ForecastReport> {
  const { raw, meta } = await fetchSources();
  if (!raw.length) throw new PublicError("The forecast service returned no data.");
  return buildReport(raw, meta, Date.now(), LOCATION.timezone);
}
