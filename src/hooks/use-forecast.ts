"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "@/config/copy";
import { REFRESH } from "@/config/tuning";
import type { ForecastReport } from "@/lib/forecast/types";

type Status = "loading" | "ready" | "error";

interface ForecastState {
  status: Status;
  report: ForecastReport | null;
  error: string;
}

/**
 * Loads the forecast and keeps it fresh: hourly refresh, plus a refetch when a
 * backgrounded tab is refocused after the data has gone stale. A failed refresh
 * quietly keeps the last good report; only a failed first load surfaces.
 */
export function useForecast(initial?: ForecastReport | null) {
  // Seeded from the server-rendered page, so the first paint is the report
  // rather than skeletons. The mount fetch below still runs: the seed came from
  // whatever HTML the reader was served, and only a fetch can rule out that
  // some layer cached it.
  const [state, setState] = useState<ForecastState>(() =>
    initial
      ? { status: "ready", report: initial, error: "" }
      : { status: "loading", report: null, error: "" },
  );
  const lastLoad = useRef(0);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const res = await fetch("/api/forecast", { cache: "no-store" });
      const json = await res.json();
      if (id !== reqId.current) return; // a newer load has superseded this one
      if (!res.ok || json?.error) {
        throw new Error(json?.error || COPY.states.genericError);
      }
      lastLoad.current = Date.now();
      setState({ status: "ready", report: json as ForecastReport, error: "" });
    } catch (error) {
      if (id !== reqId.current) return; // stale failure, ignore
      const message = error instanceof Error ? error.message : COPY.states.genericError;
      // Keep the last good report on a refresh failure; only fail cold starts.
      setState((prev) =>
        prev.report ? prev : { status: "error", report: null, error: message },
      );
    }
  }, []);

  const retry = useCallback(() => {
    setState({ status: "loading", report: null, error: "" });
    void load();
  }, [load]);

  useEffect(() => {
    // Fetching the forecast is an external-data subscription; load() only calls
    // setState after the request resolves, so this is not a synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const refresh = setInterval(() => void load(), REFRESH.intervalMs);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastLoad.current > REFRESH.staleAfterMs) {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { ...state, retry };
}
