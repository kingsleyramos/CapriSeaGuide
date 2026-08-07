"use client";

import { useState } from "react";
import type { GrottoLive } from "@/lib/forecast/types";
import { useGrottoPolling } from "./use-grotto-polling";

/** Loads the cross-checked live Blue Grotto status, on the same cadence as the
 *  timeline it sits above. `settled` flips once the first attempt finishes,
 *  success or failure, so a dead endpoint cannot leave the placeholder up
 *  forever. */
export function useGrotto(): { live: GrottoLive | null; settled: boolean } {
  const [live, setLive] = useState<GrottoLive | null>(null);
  const [settled, setSettled] = useState(false);

  useGrottoPolling(async () => {
    try {
      const res = await fetch("/api/grotto", { cache: "no-store" });
      if (!res.ok) return;
      setLive((await res.json()) as GrottoLive);
    } catch {
      /* leave the previous value in place */
    } finally {
      setSettled(true);
    }
  });

  return { live, settled };
}
