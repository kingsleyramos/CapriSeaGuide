import { describe, expect, it } from "vitest";
import { HOURLY_MAX_LEAD, SLOT_HOURS } from "@/config/tuning";
import { buildDays, buildHours, buildReport } from "./aggregate";
import type { RawHour } from "./types";
import { buildTodayCards } from "./view";

/** Hour-by-hour detail must appear only within HOURLY_MAX_LEAD. */

const hour = (t: string, wave: number): RawHour => ({
  t,
  wind: 8,
  dir: 200,
  gust: 12,
  press: 1015,
  rain: 0,
  windModelStd: 1,
  windEnsembleStd: 1,
  wave,
  swell: wave * 0.7,
  per: 5,
  wDir: 322,
  waveModelStd: 0.05,
});

/** Four days, with the morning deteriorating hour by hour on each. */
const raw = (): RawHour[] => {
  const out: RawHour[] = [];
  for (let d = 3; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const t = `2026-08-0${d}T${String(h).padStart(2, "0")}:00`;
      out.push(hour(t, h >= 9 && h <= 12 ? 0.1 + (h - 9) * 0.35 : 0.3));
    }
  }
  return out;
};

const cards = (now: Date) => {
  const rows = raw();
  const report = buildReport(
    rows,
    { weatherModels: [], ensembleModel: "", ensembleMembers: 0, waveModels: [] },
    now.getTime(),
    "Europe/Rome",
  );
  return buildTodayCards(buildDays(buildHours(rows)), report.hours, now, "Europe/Rome");
};

describe("hourly detail follows forecast skill", () => {
  const noonToday = new Date("2026-08-03T10:00:00Z"); // 12:00 Capri on the first day

  it("gives today an hour for every hour of the slot", () => {
    const morning = cards(noonToday)[0];
    expect(morning.hourly).not.toBeNull();
    expect(morning.hourly!.map((h) => h.hour)).toEqual([...SLOT_HOURS.morning]);
  });

  it("shows the deterioration a slot average would hide", () => {
    // 09:00 is calm and 12:00 is not; the averaged card cannot say that.
    const tones = cards(noonToday)[0].hourly!.map((h) => h.tone);
    expect(tones[0]).toBe("low");
    expect(tones[tones.length - 1]).toBe("high");
  });

  it("withholds it once the models stop resolving hours", () => {
    const farOut = new Date("2026-08-03T10:00:00Z");
    const rows = raw();
    const days = buildDays(buildHours(rows));
    const beyond = days.filter((d) => d.lead > HOURLY_MAX_LEAD);
    expect(beyond.length).toBeGreaterThan(0);
    const report = buildReport(
      rows,
      { weatherModels: [], ensembleModel: "", ensembleMembers: 0, waveModels: [] },
      farOut.getTime(),
      "Europe/Rome",
    );
    const late = buildTodayCards(beyond, report.hours, farOut, "Europe/Rome");
    for (const card of late) expect(card.hourly).toBeNull();
  });
});
