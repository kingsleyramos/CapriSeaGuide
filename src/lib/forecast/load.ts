import { LOCATION } from "@/config/tuning";
import { PublicError } from "@/lib/errors";
import { fetchSources } from "@/lib/sources/open-meteo";
import { buildReport } from "./aggregate";
import type { ForecastReport } from "./types";

/**
 * The assembled forecast, shared by /api/forecast and the page so the HTML and
 * the client's first refresh cannot describe different weather.
 *
 * fetchedAt is assembly time, not sensor time: the Open-Meteo fetches carry
 * their own hourly cache, so the data can be older than the stamp.
 */
export async function loadReport(): Promise<ForecastReport> {
  const { raw, meta } = await fetchSources();
  if (!raw.length) throw new PublicError("The forecast service returned no data.");
  return buildReport(raw, meta, Date.now(), LOCATION.timezone);
}
