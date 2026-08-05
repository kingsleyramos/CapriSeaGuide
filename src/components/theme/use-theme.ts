"use client";

import { useEffect, useState } from "react";
import { LOCATION } from "@/config/tuning";
import { isDaylight, nextSunEvent } from "@/lib/sun";

export type Theme = "light" | "dark";

const { lat, lon } = LOCATION.island;
const themeAt = (ms: number): Theme => (isDaylight(ms, lat, lon) ? "light" : "dark");

/**
 * The current theme, kept in step with Capri's sun.
 *
 * Starts as null so the first render matches the server's HTML, which cannot
 * know the time; the head script has already set the colours by then, so there
 * is nothing to see. Callers render nothing until it resolves.
 *
 * Rather than polling, this sleeps until the next sunrise or sunset. A tab
 * suspended past that moment gets caught by the visibility check.
 */
export function useTheme(): Theme | null {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const apply = () => {
      const now = Date.now();
      const next = themeAt(now);
      setTheme(next);
      document.documentElement.dataset.theme = next;

      clearTimeout(timer);
      // +1s so the timer lands the far side of the boundary, never on it.
      const wait = nextSunEvent(now, lat, lon) - now + 1000;
      // setTimeout clamps above ~24.9 days; the longest wait here is one night.
      timer = setTimeout(apply, Math.max(1000, wait));
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };

    apply();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return theme;
}
