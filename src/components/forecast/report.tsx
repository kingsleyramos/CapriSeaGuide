"use client";

import { COPY } from "@/config/copy";
import { REFRESH } from "@/config/tuning";
import { buildNowView, buildTodayCards } from "@/lib/forecast/view";
import { useForecast } from "@/hooks/use-forecast";
import { useGrotto } from "@/hooks/use-grotto";
import { useNow } from "@/hooks/use-now";
import { GrottoBar } from "./grotto-bar";
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
  if (status === "error" || !report) {
    return <ErrorReport message={error || COPY.states.genericError} onRetry={retry} />;
  }

  const nowView = buildNowView(report.hours, report.fetchedAt, now, report.timezone);
  const todayCards = buildTodayCards(report.days[0]);

  return (
    <div className="grid gap-3.5">
      <NowCard now={nowView} />
      <GrottoBar live={live} />
      <TodayCards cards={todayCards} />
      <SevenDay days={report.days} />
      <Methodology updatedLine={nowView.updatedLine} />
    </div>
  );
}
