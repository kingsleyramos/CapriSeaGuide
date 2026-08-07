"use client";

import { useEffect, useState } from "react";
import { grottoPollDelayMs } from "@/lib/forecast/grotto-actual";
import type { GrottoTimelinePayload } from "@/lib/forecast/grotto-view";

/** Loads the Blue Grotto timeline (today's bar + last-7-day history) and
 *  refreshes on the recorder's cadence while the cave is open, hourly otherwise.
 *  `settled` flips once the first attempt finishes, success or failure, so a
 *  dead endpoint cannot leave the placeholder up forever. */
export function useGrottoHistory(): { data: GrottoTimelinePayload | null; settled: boolean } {
  const [data, setData] = useState<GrottoTimelinePayload | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

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
        if (active) {
          setSettled(true);
          // Chained rather than an interval so the delay is re-read each time: a
          // tab left open across opening time speeds up, and one left across
          // closing slows down again.
          timer = setTimeout(() => void load(), grottoPollDelayMs());
        }
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return { data, settled };
}
