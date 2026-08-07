"use client";

import { useEffect, useState } from "react";
import { grottoPollDelayMs } from "@/lib/forecast/grotto-actual";
import type { GrottoLive } from "@/lib/forecast/types";

/** Loads the cross-checked live Blue Grotto status, refreshing on the same
 *  cadence as the timeline it sits above. `settled` flips once the first attempt
 *  finishes, success or failure, so a dead endpoint cannot leave the placeholder
 *  up forever. */
export function useGrotto(): { live: GrottoLive | null; settled: boolean } {
  const [live, setLive] = useState<GrottoLive | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch("/api/grotto", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as GrottoLive;
        if (active) setLive(json);
      } catch {
        /* leave the previous value in place */
      } finally {
        if (active) {
          setSettled(true);
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

  return { live, settled };
}
