import { NextResponse } from "next/server";
import { COPY } from "@/config/copy";
import { HISTORY_DAYS, LOCATION } from "@/config/tuning";
import { buildDays, buildHours } from "@/lib/forecast/aggregate";
import { deriveSegments } from "@/lib/forecast/grotto-actual";
import type {
  HistoryDayPayload,
  HistoryModeledSlot,
  HistorySegment,
} from "@/lib/forecast/grotto-view";
import { compass } from "@/lib/forecast/math";
import { pillTone } from "@/lib/forecast/model";
import type { HourPoint, Slot } from "@/lib/forecast/types";
import { fetchHistory } from "@/lib/sources/open-meteo";
import { readReadings } from "@/lib/store/grotto-log";

const DAY_MS = 86_400_000;

// Dynamic because it reads the recorded-status store; CDN-cached hourly via the
// Cache-Control header below (so the store is hit at most once per hour).
export const dynamic = "force-dynamic";

/** Format one moment's sea into the grid columns (keys match COPY.grottoHistory.columns). */
type SeaSource = {
  wave: number;
  swell: number;
  per: number;
  wDir: number;
  wind: number;
  gust: number;
  grotto: number;
};
const cellsFrom = (v: SeaSource): Record<string, string> => ({
  waves: `${v.wave.toFixed(1)} m`,
  swell: `${v.swell.toFixed(1)} m`,
  period: `${Math.round(v.per)} s`,
  from: compass(v.wDir),
  wind: `${Math.round(v.wind)} kt`,
  gusts: `${Math.round(v.gust)} kt`,
  modeled: `${Math.round(v.grotto * 100)}%`,
});
const hourCells = (h: HourPoint) => cellsFrom({ ...h, grotto: h.probs.grotto });
const slotCells = (s: Slot) => cellsFrom({ ...s, grotto: s.p.grotto });

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
    const C = COPY.grottoHistory;

    const payload: HistoryDayPayload[] = days.map((day) => {
      const segs = readings.length ? deriveSegments(readings, day.date, LOCATION.timezone) : [];
      const segments: HistorySegment[] | null = segs.length
        ? segs.map((s, i) => {
            const h = hours.find((x) => x.date === day.date && x.hour === s.hour);
            return {
              startMin: s.startMin,
              endMin: s.endMin,
              start: s.start,
              end: s.end,
              status: s.status,
              transitionLabel: i === 0 ? null : s.start,
              cells: h ? hourCells(h) : {},
            };
          })
        : null;

      const modeled: HistoryModeledSlot[] = (
        [
          [C.morning, day.am],
          [C.afternoon, day.pm],
        ] as const
      ).map(([label, slot]) => ({
        label,
        pct: slot ? `${Math.round(slot.p.grotto * 100)}%` : "—",
        tone: slot ? pillTone(slot.p.grotto) : "low",
        cells: slot ? slotCells(slot) : {},
      }));

      return { date: day.date, label: dayLabel(day.date), segments, modeled };
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
