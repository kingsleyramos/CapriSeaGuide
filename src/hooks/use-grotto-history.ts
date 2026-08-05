"use client";

import { useEffect, useState } from "react";
import { REFRESH } from "@/config/tuning";
import type { GrottoTimelinePayload } from "@/lib/forecast/grotto-view";

/** Loads the Blue Grotto timeline (today's bar + last-7-day history) and
 *  refreshes hourly. Returns null until the first load resolves. */
export function useGrottoHistory(): GrottoTimelinePayload | null {
  const [data, setData] = useState<GrottoTimelinePayload | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/grotto-history", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (active && json && !json.error) {
          setData({ today: json.today ?? null, days: (json.days ?? []) as GrottoTimelinePayload["days"] });
        }
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

  return data;
}
