"use client";

import { useEffect, useState } from "react";

/**
 * A Date that advances on an interval, so time-relative wording ("3 min ago",
 * the current hour) stays live without re-fetching.
 *
 * `initial` seeds it with the clock the server rendered against. Every visible
 * string here is derived from this value, so without it the first client render
 * would disagree with the HTML by however long the request took, and React
 * would report a hydration mismatch on the clock line. The real time is applied
 * on mount, once hydration is safely past.
 */
export function useNow(intervalMs: number, initial?: number): Date {
  const [now, setNow] = useState(() => (initial == null ? new Date() : new Date(initial)));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
