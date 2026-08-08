"use client";

import { useEffect, useState } from "react";

/**
 * A Date that advances on an interval, so time-relative wording ("3 min ago",
 * the current hour) stays live without re-fetching.
 *
 * `initial` must be the clock the server rendered against: every visible string
 * derives from this, so anything else hydrates into a mismatch. Real time is
 * applied on mount.
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
