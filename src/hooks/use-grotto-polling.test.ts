/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REFRESH } from "@/config/tuning";
import { useGrottoPolling } from "./use-grotto-polling";

/** Inside opening hours (12:00 Capri), so the hook uses the live cadence. */
const OPEN_HOURS = Date.parse("2026-08-04T10:00:00Z");

const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
};

const fireVisibility = (state: "visible" | "hidden") => {
  setVisibility(state);
  document.dispatchEvent(new Event("visibilitychange"));
};

/** Let the hook's async run() settle without moving the clock. Testing
 *  Library's waitFor polls on real timers and deadlocks against fake ones. */
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(OPEN_HOURS);
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useGrottoPolling", () => {
  it("loads once on mount", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useGrottoPolling(load));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again after the live cadence elapses", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useGrottoPolling(load));
    await flush();

    await vi.advanceTimersByTimeAsync(REFRESH.liveIntervalMs);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("refetches when a frozen tab returns to a stale copy", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useGrottoPolling(load));
    await flush();

    // Moves the wall clock without running timers, which is what a browser does
    // to a backgrounded tab: throttled or frozen entirely, so the scheduled poll
    // never fired and the copy went stale. This is the case focus covers and an
    // interval cannot.
    fireVisibility("hidden");
    vi.setSystemTime(OPEN_HOURS + REFRESH.liveIntervalMs + 1000);

    fireVisibility("visible");
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not refetch on a glance at a copy the CDN cannot have replaced", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useGrottoPolling(load));
    await flush();

    fireVisibility("hidden");
    await vi.advanceTimersByTimeAsync(1000);
    fireVisibility("visible");
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("stops polling after unmount", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useGrottoPolling(load));
    await flush();

    unmount();
    await vi.advanceTimersByTimeAsync(REFRESH.liveIntervalMs * 3);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps polling when the caller passes a new closure each render", async () => {
    // The ref indirection exists for this: an inline closure must not restart
    // the schedule, or the timer resets every render and never fires.
    const load = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(() => useGrottoPolling(() => load()));
    await flush();

    rerender();
    rerender();
    await vi.advanceTimersByTimeAsync(REFRESH.liveIntervalMs);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
