"use client";

import { useEffect, useState } from "react";
import { REFRESH } from "@/config/tuning";
import type { HistoryDayPayload } from "@/lib/forecast/grotto-view";

/** Loads the past-7-day Blue Grotto history and refreshes hourly.
 *  Returns null until the first load resolves. */
export function useGrottoHistory(): HistoryDayPayload[] | null {
  const [days, setDays] = useState<HistoryDayPayload[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/grotto-history", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (active && json && !json.error) setDays(json.days as HistoryDayPayload[]);
      } catch {
        /* keep the previous value */
      }
    };
    void load();
    const id = setInterval(() => void load(), REFRESH.intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return days;
}
