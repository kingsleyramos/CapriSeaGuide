"use client";

import { COPY } from "@/config/copy";
import { REFRESH } from "@/config/tuning";
import { buildGrottoTimeline, buildGrottoView } from "@/lib/forecast/grotto-view";
import { buildNowView, buildTodayCards } from "@/lib/forecast/view";
import { useForecast } from "@/hooks/use-forecast";
import { useGrotto } from "@/hooks/use-grotto";
import { useGrottoHistory } from "@/hooks/use-grotto-history";
import { useNow } from "@/hooks/use-now";
import { GrottoStatus } from "./grotto-status";
import { Methodology } from "./methodology";
import { NowCard } from "./now-card";
import { SevenDay } from "./seven-day";
import { ErrorReport, LoadingReport } from "./states";
import { TodayCards } from "./today-cards";

/** Top-level client orchestrator: fetches data, holds the live clock, and
 *  derives every display string from the numeric report at render time. */
export function Report() {
  const { status, report, error, retry } = useForecast();
  const { live, settled: liveSettled } = useGrotto();
  const { data: history, settled: historySettled } = useGrottoHistory();
  const now = useNow(REFRESH.clockTickMs);

  // A failed forecast is the only fatal one, and it reports immediately rather
  // than waiting on the other two.
  if (status === "error") {
    return <ErrorReport message={error || COPY.states.genericError} onRetry={retry} />;
  }
  // Hold the skeleton until all three fetches have settled, so the page arrives
  // in one piece. Without this the grotto timeline resolves after the forecast
  // and pops in below the fold, shifting everything under it. All three routes
  // are CDN-cached and answer in about the same time, so the slowest-wins cost
  // is negligible; a fetch that fails still settles, so nothing can hang here.
  if (status === "loading" || !liveSettled || !historySettled) return <LoadingReport />;
  if (!report || !report.hours.length || !report.days.length) {
    return <ErrorReport message={COPY.states.genericError} onRetry={retry} />;
  }

  const nowView = buildNowView(report.hours, report.fetchedAt, now, report.timezone);
  const todayCards = buildTodayCards(report.days[0]);
  const grottoView = buildGrottoView({
    verdict: live?.status ?? "unknown",
    conflict: !!live?.conflict,
    now,
    timezone: report.timezone,
    forecastGrottoProb: nowView.grottoProbNow,
  });
  const timeline = history ? buildGrottoTimeline(history) : null;

  return (
    <div className="grid gap-3.5">
      <NowCard now={nowView} />
      <GrottoStatus view={grottoView} timeline={timeline} />
      <TodayCards cards={todayCards} />
      <SevenDay days={report.days} />
      <Methodology updatedLine={nowView.updatedLine} />
    </div>
  );
}
