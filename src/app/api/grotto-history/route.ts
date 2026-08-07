import { NextResponse } from "next/server";
import { COPY } from "@/config/copy";
import { GROTTO_HOURS, HISTORY_DAYS, LOCATION, SLOT_HOURS } from "@/config/tuning";
import { buildHours } from "@/lib/forecast/aggregate";
import {
  capriParts,
  closeHourForMonth,
  deriveSegments,
  minToHHMM,
  modeledSegments,
} from "@/lib/forecast/grotto-actual";
import type {
  BarSegment,
  HistoryDayPayload,
  HistoryRow,
  TodayPayload,
} from "@/lib/forecast/grotto-view";
import { PublicError, publicMessage } from "@/lib/errors";
import { compass } from "@/lib/forecast/math";
import type { HourPoint } from "@/lib/forecast/types";
import { fetchHistory } from "@/lib/sources/open-meteo";
import { readReadings } from "@/lib/store/grotto-log";

const DAY_MS = 86_400_000;
const H = COPY.grottoHistory;

// Dynamic because it reads the recorded-status store and the Capri-local clock
// (which day is "live"); CDN-cached briefly via the Cache-Control header below.
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

/** A morning/afternoon slot averaged into the same grid columns. Gusts take the
 *  slot's peak (as elsewhere); direction the mid-hour; the rest a mean. */
const slotCells = (hs: HourPoint[]): Record<string, string> => {
  const mid = hs[Math.floor(hs.length / 2)];
  const avg = (f: (h: HourPoint) => number) => hs.reduce((s, h) => s + f(h), 0) / hs.length;
  return {
    waves: `${avg((h) => h.wave).toFixed(1)} m`,
    swell: `${avg((h) => h.swell).toFixed(1)} m`,
    period: `${Math.round(avg((h) => h.per))} s`,
    from: compass(mid.wDir),
    wind: `${Math.round(avg((h) => h.wind))} kt`,
    gusts: `${Math.round(Math.max(...hs.map((h) => h.gust)))} kt`,
    modeled: `${Math.round(avg((h) => h.probs.grotto) * 100)}%`,
  };
};

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export async function GET(req: Request) {
  // Dynamic routes key the CDN cache on the query string, so unique queries
  // would each cost an invocation plus a store read. This route takes no
  // parameters; reject any query before doing work. (Prerendered routes are
  // immune and must not read req.url, which would de-optimize them.)
  if (new URL(req.url).search) {
    return NextResponse.json(
      { error: "This endpoint takes no query parameters." },
      { status: 400 },
    );
  }

  try {
    const tz = LOCATION.timezone;
    const { raw } = await fetchHistory();
    if (!raw.length) throw new PublicError("No history is available right now.");

    // Group the hourly sea by Capri-local date (past days + today + tomorrow).
    const hours = buildHours(raw);
    const byDate = new Map<string, HourPoint[]>();
    const dateList: string[] = [];
    for (const h of hours) {
      if (!byDate.has(h.date)) {
        byDate.set(h.date, []);
        dateList.push(h.date);
      }
      byDate.get(h.date)!.push(h);
    }
    const hoursOf = (date: string) => byDate.get(date) ?? [];
    const oddsOf = (date: string) =>
      hoursOf(date).map((h) => ({ hour: h.hour, grotto: h.probs.grotto }));
    const cellsAtFor = (date: string) => (hour: number) => {
      const h = hoursOf(date).find((x) => x.hour === hour);
      return h ? cellsFrom(h) : {};
    };

    // Where are we in the Capri day? The live bar is today until it closes, then
    // tomorrow; today then drops into history (below).
    const now = Date.now();
    const { date: todayDate, month, minute: nowMin } = capriParts(now, tz);
    const openMin = GROTTO_HOURS.open * 60;
    const closeMin = closeHourForMonth(month) * 60;
    const afterClose = nowMin >= closeMin;
    const tomorrowDate = dateList[dateList.indexOf(todayDate) + 1];
    const liveDate = afterClose && tomorrowDate ? tomorrowDate : todayDate;

    const readings = await readReadings(now - (HISTORY_DAYS + 1) * DAY_MS, now);

    // ---- The live day: reported so far (solid), then forecast to close (pale).
    let reportedMin: number | null = null;
    let reportedBar: BarSegment[] = [];
    if (liveDate === todayDate && !afterClose) {
      const todayReadings = readings
        .map((r) => ({ ...capriParts(r.t, tz), status: r.status }))
        .filter((r) => r.date === todayDate && r.status !== "unknown");
      if (todayReadings.length) {
        reportedMin = Math.max(...todayReadings.map((r) => r.minute));
        reportedBar = deriveSegments(readings, todayDate, tz, reportedMin).map((s, i) => ({
          startMin: s.startMin,
          endMin: s.endMin,
          tone: s.status,
          label: i > 0 ? s.start : null,
        }));
      }
    }
    const forecastBar: BarSegment[] = modeledSegments(oddsOf(liveDate), liveDate, {
      fromMin: reportedMin ?? openMin,
    }).map((s) => ({ startMin: s.startMin, endMin: s.endMin, tone: s.tone, label: null }));
    const liveBar = [...reportedBar, ...forecastBar];
    const today: TodayPayload | null = liveBar.length
      ? {
          date: liveDate,
          label: liveDate === todayDate ? H.today : H.tomorrow,
          bar: liveBar,
          lastCheckMin: reportedMin,
          lastCheckLabel: reportedMin != null ? minToHHMM(reportedMin) : null,
        }
      : null;

    // ---- History: completed days before the live day, most recent first.
    const historyDates = dateList.filter((d) => d < liveDate).slice(-HISTORY_DAYS).reverse();
    const days: HistoryDayPayload[] = historyDates.map((date) => {
      const cellsAt = cellsAtFor(date);
      const reported = deriveSegments(readings, date, tz);

      // With the boatmen's calls: solid open/closed runs, sea at each change.
      if (reported.length) {
        const bar: BarSegment[] = reported.map((s, i) => ({
          startMin: s.startMin,
          endMin: s.endMin,
          tone: s.status,
          label: i > 0 ? s.start : null,
        }));
        const rows: HistoryRow[] = reported.map((s) => ({
          time: `${s.start}–${s.end}`,
          statusLabel: H.statusWord[s.status],
          tone: s.status,
          cells: cellsAt(s.hour),
        }));
        return { date, label: dayLabel(date), kind: "reported", bar, rows };
      }

      // No recorded status: a single grey bar, but still the sea, morning and
      // afternoon (never forecast-labelled: the past is not a forecast).
      const monthOf = Number(date.slice(5, 7)) - 1;
      const dayClose = closeHourForMonth(monthOf) * 60;
      const bar: BarSegment[] = [{ startMin: openMin, endMin: dayClose, tone: "none", label: null }];
      const slots: { label: string; hours: HourPoint[] }[] = [
        { label: H.slot.morning, hours: hoursOf(date).filter((h) => (SLOT_HOURS.morning as readonly number[]).includes(h.hour)) },
        { label: H.slot.afternoon, hours: hoursOf(date).filter((h) => (SLOT_HOURS.afternoon as readonly number[]).includes(h.hour)) },
      ];
      const rows: HistoryRow[] = slots
        .filter((s) => s.hours.length)
        .map((s) => ({ time: s.label, statusLabel: H.noData, tone: "none", cells: slotCells(s.hours) }));
      return { date, label: dayLabel(date), kind: "none", bar, rows };
    });

    // Tighter than the forecast routes: readings land every 10 min, and a
    // ceiling above that cadence hides one that has already been recorded.
    return NextResponse.json(
      { today, days },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: publicMessage(error, "Failed to load history.") },
      { status: 502 },
    );
  }
}
