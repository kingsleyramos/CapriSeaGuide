"use client";

import { useEffect, useRef } from "react";
import { REFRESH } from "@/config/tuning";
import { grottoPollDelayMs } from "@/lib/forecast/grotto-actual";

/**
 * Drives both grotto fetches: once on mount, again on the recorder's cadence,
 * and immediately when a backgrounded tab returns to a copy that could have
 * changed.
 *
 * The visibility check is what keeps a long-open tab honest. An interval alone
 * spends requests on a tab nobody is watching, and still shows a stale copy at
 * the one moment that matters -- when someone looks. Refetching on return costs
 * nothing while hidden and is current on arrival.
 *
 * The interval is kept as a floor for the opposite case, a tab that is watched
 * and never hidden, where `visibilitychange` never fires at all.
 */
export function useGrottoPolling(load: () => Promise<void>) {
  // Held in a ref so a caller can pass an inline closure without restarting the
  // schedule on every render.
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
      // Bounded by the CDN window rather than refetching on every glance:
      // nothing newer than our copy can exist inside it, so a rapid tab switch
      // would spend a request to be handed back what we already have.
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
