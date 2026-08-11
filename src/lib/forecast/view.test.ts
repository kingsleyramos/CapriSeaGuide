import { describe, expect, it } from "vitest";
import { ACTIVITIES, type ActivityKey } from "@/config/activities";
import { COPY } from "@/config/copy";
import type { CompactHour } from "./types";
import { buildNowView } from "./view";

const TZ = "Europe/Rome";

/** Every activity, all calm. Derived from ACTIVITIES so a new key cannot leave
 *  this fixture short of one and fail somewhere unrelated. */
const probs = Object.fromEntries(ACTIVITIES.map((a) => [a.key, 0.04])) as Record<
  ActivityKey,
  number
>;

/** One hour of flat, calm sea. Only the timestamp fields vary between cases;
 *  the readings exist so buildNowView has a current hour to describe. */
const hour = (date: string, h: number): CompactHour => ({
  t: `${date}T${String(h).padStart(2, "0")}:00`,
  date,
  hour: h,
  wave: 0.2,
  swell: 0.2,
  per: 5,
  wDir: 180,
  wind: 4,
  dir: 180,
  gust: 6,
  press: 1015,
  rain: 0,
  dp: 0.1,
  spread: 0.1,
  probs,
});

const hours = Array.from({ length: 24 }, (_, h) => hour("2026-08-07", h));
const lineAt = (nowIso: string, fetchedIso: string) =>
  buildNowView(hours, Date.parse(fetchedIso), new Date(Date.parse(nowIso)), TZ).updatedLine;

describe("updatedLine", () => {
  it("is a bare Capri time when the reading is minutes old", () => {
    // 06:06 Capri on a summer day is 04:06 UTC.
    expect(lineAt("2026-08-07T04:06:00Z", "2026-08-07T04:04:00Z")).toBe("06:04 Capri time");
  });

  it("names the day when the reading is not from today", () => {
    // Undated, yesterday's 06:31 reads as the future beside a 06:06 clock.
    const line = lineAt("2026-08-07T04:06:00Z", "2026-08-06T04:31:00Z");
    expect(line).toContain("06:31");
    expect(line).toContain("on 6 Aug");
  });

  it("never reports a stale reading in raw minutes", () => {
    expect(lineAt("2026-08-07T04:06:00Z", "2026-08-06T04:31:00Z")).not.toContain("1414 min");
  });
});

describe("ago", () => {
  const ago = COPY.now.ago;

  it("keeps minutes while they are still readable", () => {
    expect(ago(7)).toBe("(7 min ago)");
    expect(ago(89)).toBe("(89 min ago)");
  });

  it("switches to hours, then to days", () => {
    expect(ago(90)).toBe("(2 h ago)");
    expect(ago(1414)).toBe("(24 h ago)");
    expect(ago(4320)).toBe("(3 d ago)");
  });
});

describe("an observation outranks the forecast", () => {
  // Regression: a headline of "no weather closures expected" above a red CLOSED
  // chip, from a summary that only ever saw the model.
  const calmDay = "2026-08-07T10:00:00Z"; // 12:00 Capri, inside opening hours
  const line = (reported?: "open" | "closed" | "unknown") =>
    buildNowView(hours, Date.parse(calmDay), new Date(Date.parse(calmDay)), TZ, reported).headline;

  it("says the sea is calm when nothing contradicts it", () => {
    expect(line()).toMatch(/no weather closures expected/i);
    expect(line("open")).toMatch(/no weather closures expected/i);
  });

  it("names the disagreement when the boatmen have closed a calm sea", () => {
    expect(line("closed")).toMatch(/boatmen have closed/i);
    expect(line("closed")).not.toMatch(/no weather closures expected/i);
  });

  it("ignores a reported closure outside opening hours", () => {
    // 02:00 Capri: the cave is shut because it is the middle of the night, which
    // says nothing about the sea.
    const night = Date.parse("2026-08-07T00:00:00Z");
    const headline = buildNowView(hours, night, new Date(night), TZ, "closed").headline;
    expect(headline).toMatch(/no weather closures expected/i);
  });
});
