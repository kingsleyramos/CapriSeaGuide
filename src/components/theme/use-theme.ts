"use client";

import { useCallback, useEffect, useState } from "react";
import { LOCATION } from "@/config/tuning";
import { isDaylight, nextSunEvent } from "@/lib/sun";
import { THEME_KEY } from "./theme-script";

export type Theme = "light" | "dark";

const { lat, lon } = LOCATION.island;
const themeAt = (ms: number): Theme => (isDaylight(ms, lat, lon) ? "light" : "dark");

/** Both of these swallow errors: localStorage throws outright in some privacy
 *  modes, and the theme is never worth breaking the page over. */
function readOverride(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function writeOverride(theme: Theme | null) {
  try {
    if (theme) localStorage.setItem(THEME_KEY, theme);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    /* ignore */
  }
}

export interface ThemeState {
  /** Null until the client resolves it; the head script has already painted. */
  theme: Theme | null;
  /** Whether the reader has overridden the sun. */
  overridden: boolean;
  /** Flip to the other theme, and remember it. */
  toggle: () => void;
}

/**
 * The theme, following Capri's daylight unless the reader has said otherwise.
 *
 * Starts null so the first render matches the server's HTML, which cannot know
 * the time. The head script has already applied the colours by then, so there is
 * nothing to see; components render nothing until this resolves.
 *
 * While the sun is in charge this sleeps until the next sunrise or sunset rather
 * than polling, and re-checks when a suspended tab returns. An overridden theme
 * needs neither.
 */
export function useTheme(): ThemeState {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [overridden, setOverridden] = useState(false);

  const apply = useCallback((next: Theme) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const sync = () => {
      const override = readOverride();
      setOverridden(override !== null);
      if (override) {
        apply(override);
        clearTimeout(timer);
        return;
      }
      const now = Date.now();
      apply(themeAt(now));
      clearTimeout(timer);
      // +1s so the timer lands the far side of the boundary, never on it.
      timer = setTimeout(sync, Math.max(1000, nextSunEvent(now, lat, lon) - now + 1000));
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      writeOverride(next);
      setOverridden(true);
      document.documentElement.dataset.theme = next;
      return next;
    });
  }, []);

  return { theme, overridden, toggle };
}
