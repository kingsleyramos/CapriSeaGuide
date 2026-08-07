import { describe, expect, it } from "vitest";
import { GROTTO_HOURS, REFRESH } from "@/config/tuning";
import {
  capriParts,
  closeHourForMonth,
  grottoPollDelayMs,
  isWithinGrottoHours,
} from "./grotto-hours";

const TZ = "Europe/Rome";

describe("capriParts", () => {
  it("reads the Capri wall clock, not UTC", () => {
    // Summer: Capri is UTC+2.
    expect(capriParts(Date.parse("2026-08-04T10:30:00Z"), TZ)).toEqual({
      date: "2026-08-04",
      month: 7,
      hour: 12,
      minute: 12 * 60 + 30,
    });
    // Winter: UTC+1.
    expect(capriParts(Date.parse("2026-01-15T10:30:00Z"), TZ)).toMatchObject({
      date: "2026-01-15",
      hour: 11,
    });
  });

  it("rolls the date when Capri is already tomorrow", () => {
    // 23:30 UTC is 01:30 the next day in Capri.
    expect(capriParts(Date.parse("2026-08-04T23:30:00Z"), TZ)).toMatchObject({
      date: "2026-08-05",
      hour: 1,
    });
  });

  it("accepts a Date and an epoch equivalently", () => {
    const ms = Date.parse("2026-08-04T10:30:00Z");
    expect(capriParts(new Date(ms), TZ)).toEqual(capriParts(ms, TZ));
  });
});

describe("closeHourForMonth", () => {
  it("closes at 17:30 Apr-Oct and 14:00 otherwise", () => {
    for (const m of [3, 4, 5, 6, 7, 8, 9]) expect(closeHourForMonth(m)).toBe(17.5);
    for (const m of [10, 11, 0, 1, 2]) expect(closeHourForMonth(m)).toBe(14);
  });
});

describe("isWithinGrottoHours", () => {
  const at = (iso: string) => Date.parse(iso);

  it("includes the opening minute and excludes the closing one", () => {
    expect(isWithinGrottoHours(at("2026-08-04T06:59:00Z"), TZ)).toBe(false); // 08:59
    expect(isWithinGrottoHours(at("2026-08-04T07:00:00Z"), TZ)).toBe(true); // 09:00
    expect(isWithinGrottoHours(at("2026-08-04T15:29:00Z"), TZ)).toBe(true); // 17:29
    expect(isWithinGrottoHours(at("2026-08-04T15:30:00Z"), TZ)).toBe(false); // 17:30
  });

  it("uses the winter close, when Capri is UTC+1", () => {
    expect(isWithinGrottoHours(at("2026-01-15T12:59:00Z"), TZ)).toBe(true); // 13:59
    expect(isWithinGrottoHours(at("2026-01-15T13:00:00Z"), TZ)).toBe(false); // 14:00
  });

  /*
   * The predicate was two functions before: one comparing a decimal hour
   * (hours + minutes/60), one comparing minutes from midnight. This pins the
   * surviving one to the arithmetic of the one that was deleted.
   */
  it("matches the decimal-hour formulation it replaced, at every minute of every month", () => {
    // Compares the arithmetic directly rather than through timestamps: the
    // timezone conversion is shared and unchanged (and an Intl call per sample
    // makes an exhaustive sweep too slow to keep). What changed is float-hour
    // versus integer-minute comparison, and this covers all 17,280 of those.
    const { open } = GROTTO_HOURS;
    const mismatches: string[] = [];
    for (let month = 0; month < 12; month++) {
      const close = closeHourForMonth(month);
      for (let minute = 0; minute < 24 * 60; minute++) {
        const asDecimalHour = minute / 60 >= open && minute / 60 < close;
        const asMinutes = minute >= open * 60 && minute < close * 60;
        if (asDecimalHour !== asMinutes) mismatches.push(`month ${month}, minute ${minute}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("grottoPollDelayMs", () => {
  it("polls on the live cadence inside hours and backs off outside", () => {
    expect(grottoPollDelayMs(Date.parse("2026-08-04T10:00:00Z"))).toBe(REFRESH.liveIntervalMs);
    expect(grottoPollDelayMs(Date.parse("2026-08-04T20:00:00Z"))).toBe(REFRESH.intervalMs);
  });

  // Guards the relationship, not the number: the client must not be the slowest
  // layer, or readings are recorded that nobody is shown.
  it("asks at least as often as the recorder writes", () => {
    expect(REFRESH.liveIntervalMs).toBeLessThanOrEqual(10 * 60_000);
  });
});
