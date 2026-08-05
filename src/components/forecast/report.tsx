"use client";

import { COPY } from "@/config/copy";
import { REFRESH } from "@/config/tuning";
import { buildGrottoTimeline, buildGrottoView } from "@/lib/forecast/grotto-view";
import type { ForecastReport } from "@/lib/forecast/types";
import { buildNowView, buildTodayCards } from "@/lib/forecast/view";
import { useForecast } from "@/hooks/use-forecast";
import { useGrotto } from "@/hooks/use-grotto";
import { useGrottoHistory } from "@/hooks/use-grotto-history";
import { useNow } from "@/hooks/use-now";
import { GrottoStatus } from "./grotto-status";
import { Methodology } from "./methodology";
import { NowCard } from "./now-card";
import { SevenDay } from "./seven-day";
import { NowCardSkeleton, SevenDaySkeleton, TodayCardsSkeleton } from "./skeletons";
import { ErrorReport } from "./states";
import { TodayCards } from "./today-cards";

/** A report we can actually render from: the engine needs both series. */
const usable = (r: ForecastReport | null): r is ForecastReport =>
  !!r && r.hours.length > 0 && r.days.length > 0;

/** Top-level client orchestrator: fetches data, holds the live clock, and
 *  derives every display string from the numeric report at render time. */
export function Report() {
  const { status, report, error, retry } = useForecast();
  const { live, settled: liveSettled } = useGrotto();
  const { data: history, settled: historySettled } = useGrottoHistory();
  const now = useNow(REFRESH.clockTickMs);

  if (status === "error" || (status === "ready" && !usable(report))) {
    return <ErrorReport message={error || COPY.states.genericError} onRetry={retry} />;
  }

  // Each region renders as soon as its own data lands rather than the page
  // waiting on the slowest fetch. What keeps that from shifting the layout is
  // that every placeholder reserves the space its content will occupy (see
  // ./skeletons and GrottoStatus): reserving the space is the fix for layout
  // shift — holding the whole page back until nothing has to move only hides it,
  // and makes the page only ever as fast as its slowest dependency.
  const ready = usable(report);
  const nowView = ready
    ? buildNowView(report.hours, report.fetchedAt, now, report.timezone)
    : null;

  // The status line quotes our own odds when the boatmen's verdict is
  // unreadable, so that one branch genuinely needs the forecast too. Rather
  // than invent a third state for an unknown-with-no-odds reading, the chip
  // waits for both — the timeline below it still fills in on its own.
  const grottoSettled = liveSettled && ready;
  const grottoView = buildGrottoView({
    verdict: live?.status ?? "unknown",
    conflict: !!live?.conflict,
    now,
    timezone: report?.timezone,
    forecastGrottoProb: nowView?.grottoProbNow ?? 0,
  });
  const timeline = history ? buildGrottoTimeline(history) : null;

  return (
    <div className="grid gap-3.5">
      {nowView ? <NowCard now={nowView} /> : <NowCardSkeleton />}
      <GrottoStatus
        view={grottoView}
        timeline={timeline}
        liveSettled={grottoSettled}
        historySettled={historySettled}
      />
      {ready ? <TodayCards cards={buildTodayCards(report.days[0])} /> : <TodayCardsSkeleton />}
      {ready ? <SevenDay days={report.days} /> : <SevenDaySkeleton />}
      <Methodology updatedLine={nowView?.updatedLine} />
    </div>
  );
}
