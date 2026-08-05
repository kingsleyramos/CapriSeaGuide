"use client";

import { useEffect, useState } from "react";
import { REFRESH } from "@/config/tuning";
import type { GrottoTimelinePayload } from "@/lib/forecast/grotto-view";

/**
 * Loads the Blue Grotto timeline (today's bar + last-7-day history) and
 * refreshes hourly.
 *
 * `data` is null until the first load resolves. `settled` flips true once that
 * first attempt finishes either way — succeeded or failed — so the report can
 * hold the skeleton until every fetch is in and render the page in one piece
 * (see Report). A failure settles too: the timeline is optional, so a dead
 * endpoint should cost the card its bar, not strand the whole page.
 */
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
        // Idempotent: React bails out of the re-render on later refreshes.
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
