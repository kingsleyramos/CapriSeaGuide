"use client";

import { useEffect, useState } from "react";
import { REFRESH } from "@/config/tuning";
import type { GrottoLive } from "@/lib/forecast/types";

/** Loads the cross-checked live Blue Grotto status and refreshes hourly.
 *  Returns null until the first read resolves; the bar shows "Unknown" meanwhile. */
export function useGrotto(): GrottoLive | null {
  const [live, setLive] = useState<GrottoLive | null>(null);

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
      }
    };
    void load();
    const id = setInterval(() => void load(), REFRESH.intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return live;
}
