import { NextResponse } from "next/server";
import { HISTORY_DAYS, LOCATION } from "@/config/tuning";
import { buildDays, buildHours } from "@/lib/forecast/aggregate";
import { deriveSegments, estimateSegments } from "@/lib/forecast/grotto-actual";
import type { HistoryDayPayload, HistorySegment } from "@/lib/forecast/grotto-view";
import { compass } from "@/lib/forecast/math";
import type { HourPoint } from "@/lib/forecast/types";
import { fetchHistory } from "@/lib/sources/open-meteo";
import { readReadings } from "@/lib/store/grotto-log";

const DAY_MS = 86_400_000;

// Dynamic because it reads the recorded-status store; CDN-cached hourly via the
// Cache-Control header below (so the store is hit at most once per hour).
export const dynamic = "force-dynamic";

/** One hour's sea, formatted for the grid columns (keys match COPY.grottoHistory.columns). */
const cellsFrom = (h: HourPoint): Record<string, string> => ({
  waves: `${h.wave.toFixed(1)} m`,
  swell: `${h.swell.toFixed(1)} m`,
  period: `${Math.round(h.per)} s`,
  from: compass(h.wDir),
  wind: `${Math.round(h.wind)} kt`,
  gusts: `${Math.round(h.gust)} kt`,
  modeled: `${Math.round(h.probs.grotto * 100)}%`,
});

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export async function GET() {
  try {
    const { raw } = await fetchHistory();
    if (!raw.length) throw new Error("No history is available right now.");

    // fetchHistory returns HISTORY_DAYS past days + today; keep the past days,
    // most recent first. Keep the hourly data too, to pair segments with sea.
    const hours = buildHours(raw);
    const days = buildDays(hours, HISTORY_DAYS).reverse();

    const now = Date.now();
    const readings = await readReadings(now - (HISTORY_DAYS + 1) * DAY_MS, now);

    const payload: HistoryDayPayload[] = days.map((day) => {
      const dayHours = hours.filter((h) => h.date === day.date);
      const cellsAt = (hour: number): Record<string, string> => {
        const h = dayHours.find((x) => x.hour === hour);
        return h ? cellsFrom(h) : {};
      };

      // Prefer the boatmen's recorded calls; fall back to a forecast estimate.
      const reported = readings.length ? deriveSegments(readings, day.date, LOCATION.timezone) : [];
      const source = reported.length
        ? reported
        : estimateSegments(
            dayHours.map((h) => ({ hour: h.hour, grotto: h.probs.grotto })),
            day.date,
          );
      const kind: HistoryDayPayload["kind"] = reported.length
        ? "reported"
        : source.length
          ? "estimated"
          : "none";

      const segments: HistorySegment[] = source.map((s, i) => ({
        startMin: s.startMin,
        endMin: s.endMin,
        start: s.start,
        end: s.end,
        status: s.status,
        // Times only on reported bars (estimates are hour-resolution guesses).
        transitionLabel: kind === "reported" && i > 0 ? s.start : null,
        cells: cellsAt(s.hour),
      }));

      return { date: day.date, label: dayLabel(day.date), kind, segments };
    });

    return NextResponse.json(
      { days: payload },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
