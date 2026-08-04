"use client";

import { useEffect, useState } from "react";

/** A Date that advances on an interval, so time-relative wording ("3 min ago",
 *  the current hour) stays live without re-fetching. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
