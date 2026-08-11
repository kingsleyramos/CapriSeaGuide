import { Report } from "@/components/forecast/report";
import { loadReport } from "@/lib/forecast/load";
import type { ForecastReport } from "@/lib/forecast/types";

/** Per request: the forecast is in this HTML, and both prerendering and ISR
 *  would serve a headline from some earlier visitor's request. The Open-Meteo
 *  fetches cache separately, so this costs an assembly, not an upstream call. */
export const dynamic = "force-dynamic";

export default async function Page() {
  // Degrade rather than 500: the client retries, and until it lands the reader
  // gets the skeletons a cold load has always shown.
  let initialReport: ForecastReport | null = null;
  try {
    initialReport = await loadReport();
  } catch {
    initialReport = null;
  }

  return (
    <main id="report" className="mx-auto max-w-[960px] px-4 pt-5 pb-[72px]">
      <Report initialReport={initialReport} serverNow={initialReport?.fetchedAt} />
    </main>
  );
}
