import { NextResponse } from "next/server";
import { HISTORY_DAYS, LOCATION } from "@/config/tuning";
import { buildDays, buildHours } from "@/lib/forecast/aggregate";
import { deriveActualDay } from "@/lib/forecast/grotto-actual";
import type { HistoryDay } from "@/lib/forecast/grotto-view";
import { compass } from "@/lib/forecast/math";
import { fetchHistory } from "@/lib/sources/open-meteo";
import { readReadings } from "@/lib/store/grotto-log";

const DAY_MS = 86_400_000;

// Dynamic because it reads the recorded-status store; CDN-cached hourly via the
// Cache-Control header below (so the store is hit at most once per hour).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { raw } = await fetchHistory();
    if (!raw.length) throw new Error("No history is available right now.");

    // fetchHistory returns HISTORY_DAYS past days + today; keep the past days,
    // most recent first. Keep the hourly data too, to pair changes with sea.
    const hours = buildHours(raw);
    const days = buildDays(hours, HISTORY_DAYS).reverse();

    const now = Date.now();
    const readings = await readReadings(now - (HISTORY_DAYS + 1) * DAY_MS, now);

    const withActual: HistoryDay[] = days.map((day) => {
      if (!readings.length) return { ...day, actual: null };
      const a = deriveActualDay(readings, day.date, LOCATION.timezone);
      const transitions = a.transitions.map((tr) => {
        const h = hours.find((x) => x.date === day.date && x.hour === tr.hour);
        return {
          time: tr.time,
          to: tr.to,
          wave: h ? Number(h.wave.toFixed(1)) : null,
          wind: h ? Math.round(h.wind) : null,
          from: h ? compass(h.wDir) : null,
        };
      });
      return { ...day, actual: { am: a.am, pm: a.pm, transitions } };
    });

    return NextResponse.json(
      { days: withActual },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
