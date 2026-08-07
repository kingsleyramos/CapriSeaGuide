import { Report } from "@/components/forecast/report";
import { loadReport } from "@/lib/forecast/load";
import type { ForecastReport } from "@/lib/forecast/types";

/**
 * Per request, so the forecast is in the HTML. This page is the content a
 * crawler indexes, and prerendering it would ship a headline from build time;
 * ISR would ship one from whenever the last visitor called. The Open-Meteo
 * fetches underneath keep their own hourly cache, so rendering per request
 * costs an assembly, not an upstream call.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  // A failed load must not take the page down. The client retries on mount, and
  // until it lands the reader sees the same skeletons a cold load has always
  // shown -- degraded, not broken.
  let initialReport: ForecastReport | null = null;
  try {
    initialReport = await loadReport();
  } catch {
    initialReport = null;
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 pt-5 pb-[72px]">
      {/* fetchedAt is the clock this HTML was built against, so hydration has
          the same instant to render from. Absent on a failed load, where the
          markup holds skeletons and no time strings to disagree about. */}
      <Report initialReport={initialReport} serverNow={initialReport?.fetchedAt} />
    </main>
  );
}
