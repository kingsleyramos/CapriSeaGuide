"use client";

import { useEffect, useState } from "react";
import { REFRESH } from "@/config/tuning";
import type { GrottoLive } from "@/lib/forecast/types";

/** Loads the cross-checked live Blue Grotto status and refreshes hourly.
 *  `settled` flips once the first attempt finishes, success or failure, so a
 *  dead endpoint cannot leave the placeholder up forever. */
export function useGrotto(): { live: GrottoLive | null; settled: boolean } {
  const [live, setLive] = useState<GrottoLive | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/grotto", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as GrottoLive;
        if (active) setLive(json);
      } catch {
        /* leave the previous value in place */
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

  return { live, settled };
}
