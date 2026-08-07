"use client";

import { useEffect, useRef } from "react";
import { REFRESH } from "@/config/tuning";
import { grottoPollDelayMs } from "@/lib/forecast/grotto-view";

/**
 * Runs `load` on mount, on the grotto cadence, and when a hidden tab returns
 * stale. Both triggers are needed: a hidden tab never fires the timer usefully,
 * and a tab that is watched and never hidden never fires `visibilitychange`.
 */
export function useGrottoPolling(load: () => Promise<void>) {
  // Held in a ref so an inline closure does not restart the schedule each render.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let lastLoad = 0;

    const run = async () => {
      await loadRef.current();
      if (!active) return;
      lastLoad = Date.now();
      timer = setTimeout(() => void run(), grottoPollDelayMs());
    };

    const onVisible = () => {
      // Nothing newer can exist inside the CDN window, so a rapid tab switch
      // would refetch the copy we already hold.
      const stale = Date.now() - lastLoad > REFRESH.liveIntervalMs;
      if (document.visibilityState === "visible" && stale) {
        clearTimeout(timer);
        void run();
      }
    };

    void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
