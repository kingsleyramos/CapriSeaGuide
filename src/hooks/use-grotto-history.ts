"use client";

import { useState } from "react";
import type { GrottoTimelinePayload } from "@/lib/forecast/grotto-view";
import { useGrottoPolling } from "./use-grotto-polling";

/** Loads the Blue Grotto timeline (today's bar + last-7-day history). `settled`
 *  flips once the first attempt finishes, success or failure, so a dead endpoint
 *  cannot leave the placeholder up forever. */
export function useGrottoHistory(): { data: GrottoTimelinePayload | null; settled: boolean } {
  const [data, setData] = useState<GrottoTimelinePayload | null>(null);
  const [settled, setSettled] = useState(false);

  useGrottoPolling(async () => {
    try {
      const res = await fetch("/api/grotto-history", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json && !json.error) {
        setData({
          today: json.today ?? null,
          days: (json.days ?? []) as GrottoTimelinePayload["days"],
        });
      }
    } catch {
      /* keep the previous value */
    } finally {
      setSettled(true);
    }
  });

  return { data, settled };
}
