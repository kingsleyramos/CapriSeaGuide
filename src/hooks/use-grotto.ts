"use client";

import { useEffect, useState } from "react";
import { REFRESH } from "@/config/tuning";
import type { GrottoLive } from "@/lib/forecast/types";

/**
 * Loads the cross-checked live Blue Grotto status and refreshes hourly.
 *
 * `live` is null until the first read resolves. `settled` flips true once that
 * first attempt finishes either way — succeeded or failed — so the report can
 * hold the skeleton until every fetch is in and render the page in one piece
 * (see Report). A failure settles too: a dead endpoint must not strand the page
 * on the skeleton forever; the bar just shows "Unknown".
 */
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

  return { live, settled };
}
