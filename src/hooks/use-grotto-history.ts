"use client";

import { useEffect, useState } from "react";
import { REFRESH } from "@/config/tuning";
import type { GrottoTimelinePayload } from "@/lib/forecast/grotto-view";

/** Loads the Blue Grotto timeline (today's bar + last-7-day history) and
 *  refreshes hourly. `settled` flips once the first attempt finishes, success
 *  or failure, so a dead endpoint cannot leave the placeholder up forever. */
export function useGrottoHistory(): { data: GrottoTimelinePayload | null; settled: boolean } {
  const [data, setData] = useState<GrottoTimelinePayload | null>(null);
  const [settled, setSettled] = useState(false);

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
      } finally {
        if (active) setSettled(true);
      }
    };
    void load();
    const id = setInterval(() => void load(), REFRESH.intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return { data, settled };
}
