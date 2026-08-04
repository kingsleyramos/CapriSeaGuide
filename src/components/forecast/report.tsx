"use client";

import { COPY } from "@/config/copy";
import { REFRESH } from "@/config/tuning";
import { buildGrottoView } from "@/lib/forecast/grotto-view";
import { buildNowView, buildTodayCards } from "@/lib/forecast/view";
import { useForecast } from "@/hooks/use-forecast";
import { useGrotto } from "@/hooks/use-grotto";
import { useNow } from "@/hooks/use-now";
import { GrottoBar } from "./grotto-bar";
import { GrottoHistory } from "./grotto-history";
import { Methodology } from "./methodology";
import { NowCard } from "./now-card";
import { SevenDay } from "./seven-day";
import { ErrorReport, LoadingReport } from "./states";
import { TodayCards } from "./today-cards";

/** Top-level client orchestrator: fetches data, holds the live clock, and
 *  derives every display string from the numeric report at render time. */
export function Report() {
  const { status, report, error, retry } = useForecast();
  const live = useGrotto();
  const now = useNow(REFRESH.clockTickMs);

  if (status === "loading") return <LoadingReport />;
  if (status === "error" || !report || !report.hours.length || !report.days.length) {
    return <ErrorReport message={error || COPY.states.genericError} onRetry={retry} />;
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

  return (
    <div className="grid gap-3.5">
      <NowCard now={nowView} />
      <GrottoBar view={grottoView} />
      <TodayCards cards={todayCards} />
      <SevenDay days={report.days} />
      <GrottoHistory />
      <Methodology updatedLine={nowView.updatedLine} />
    </div>
  );
}
