/**
 * Scores the Blue Grotto model against the recorder at every forecast lead, using
 * Open-Meteo's archive of what each model run said beforehand. Needs the store and
 * the network, so it only runs under `npm run backtest`.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GROTTO_FORECAST, LOCATION, SOURCES } from "@/config/tuning";
import { MARINE_HOURLY, WEATHER_HOURLY, normalize } from "@/lib/sources/open-meteo";
import { buildHours } from "./aggregate";
import { capriParts } from "./grotto-hours";
import { mean } from "./math";

const LEADS = [0, 1, 2, 3, 4, 5, 6];
/** A day with fewer readings than this is too thin to call open or shut. */
const MIN_POLLS = 12;
/** Move this forward whenever GROTTO changes: days from here on are the only true
 *  test, because nothing was chosen by looking at them. */
const FROZEN_FROM = "2026-10-31";

type Columns = Record<string, unknown[]> & { time: string[] };

/** Local env files, for the store credentials Next would have loaded. */
function loadEnvFiles() {
  for (const file of [".env.development.local", ".env.local"]) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) process.env[m[1]] ??= m[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

/** One variable list, plus the same list as forecast 1..6 days earlier. */
const withPastRuns = (hourly: string) =>
  hourly
    .split(",")
    .flatMap((v) => [v, ...LEADS.slice(1).map((n) => `${v}_previous_day${n}`)])
    .join(",");

async function archive(base: string, params: Record<string, string>): Promise<Columns> {
  const res = await fetch(`${base}?${new URLSearchParams(params)}`);
  const json = (await res.json()) as { hourly?: Columns; reason?: string };
  if (!res.ok || !json.hourly) throw new Error(`Open-Meteo: ${json.reason ?? res.status}`);
  return json.hourly;
}

/** The feed as it stood `lead` days before each hour, under the column names
 *  the live feed uses. A model with no run that far back drops out, as it would
 *  have from the live consensus. */
function asForecast(all: Columns, models: readonly string[], lead: number) {
  const tag = lead ? `_previous_day${lead}` : "";
  const hourly: { time: string[]; [column: string]: unknown } = { time: all.time };
  for (const model of models) {
    for (const key of Object.keys(all)) {
      if (!key.endsWith(`${tag}_${model}`)) continue;
      const base = key.slice(0, key.length - `${tag}_${model}`.length);
      if (base.includes("_previous_day") || all[key].every((v) => v == null)) continue;
      hourly[`${base}_${model}`] = all[key];
    }
  }
  return { hourly };
}

describe.runIf(process.env.npm_lifecycle_event === "backtest")("grotto model vs the recorder", () => {
  it("beats a constant at short leads", { timeout: 120_000 }, async () => {
    loadEnvFiles();
    const { readReadings } = await import("@/lib/store/grotto-log");
    const readings = (await readReadings(0, Date.now())).filter((r) => r.status !== "unknown");
    expect(readings.length, "no readings: is the store configured?").toBeGreaterThan(0);

    const window = {
      timezone: LOCATION.timezone,
      start_date: capriParts(readings[0].t).date,
      end_date: capriParts(Date.now()).date,
    };
    const [marine, weather] = await Promise.all([
      archive("https://marine-api.open-meteo.com/v1/marine", {
        latitude: String(LOCATION.marine.lat),
        longitude: String(LOCATION.marine.lon),
        hourly: withPastRuns(MARINE_HOURLY),
        models: SOURCES.waveModels.join(","),
        ...window,
      }),
      archive("https://previous-runs-api.open-meteo.com/v1/forecast", {
        latitude: String(LOCATION.island.lat),
        longitude: String(LOCATION.island.lon),
        hourly: withPastRuns(WEATHER_HOURLY),
        wind_speed_unit: "kn",
        models: SOURCES.weatherModels.join(","),
        ...window,
      }),
    ]);

    // Each reading against the hour it fell in; each day by what it mostly was.
    const polls = readings.map((r) => {
      const p = capriParts(r.t);
      return { date: p.date, at: `${p.date}T${String(p.hour).padStart(2, "0")}:00`, shut: r.status === "closed" };
    });
    const byDate = new Map<string, typeof polls>();
    for (const p of polls) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
    const days = [...byDate]
      .filter(([, ps]) => ps.length >= MIN_POLLS)
      .map(([date, ps]) => ({
        date,
        hours: [...new Set(ps.map((p) => p.at))],
        shut: mean(ps.map((p) => Number(p.shut))) >= 0.5,
      }));
    const rate = mean(polls.map((p) => Number(p.shut)));
    const half = days[Math.floor(days.length / 2)].date;

    const leads = LEADS.map((lead) => {
      const { raw } = normalize(
        asForecast(marine, SOURCES.waveModels, lead),
        asForecast(weather, SOURCES.weatherModels, lead),
        { hourly: {} },
      );
      const odds = new Map(buildHours(raw).map((h) => [h.t, h.probs.grotto]));
      const calls = days
        .filter((d) => d.hours.some((t) => odds.has(t)))
        .map((d) => ({
          ...d,
          warn: mean(d.hours.flatMap((t) => odds.get(t) ?? [])) >= GROTTO_FORECAST.possibleClosureAt,
        }));
      return { lead, odds, calls };
    });
    const right = (set: { warn: boolean; shut: boolean }[]) => mean(set.map((d) => Number(d.warn === d.shut)));
    const pc = (x: number) => `${Math.round(x * 100)}%`.padStart(4);

    /** The table for one stretch of days, with the two constants to beat. */
    const table = (label: string, keep: (date: string) => boolean) => {
      const set = days.filter((d) => keep(d.date));
      if (!set.length) return [`${label}: no days yet.`];
      const shut = set.filter((d) => d.shut).length;
      const ps = polls.filter((p) => keep(p.date));
      const r = mean(ps.map((p) => Number(p.shut)));
      return [
        `${label}: ${set.length} days ${set[0].date} to ${set[set.length - 1].date}, ${shut} mostly shut.`,
        `To beat: always "open" ${pc(1 - shut / set.length).trim()} of days, always "shut" ${pc(shut / set.length).trim()}, constant Brier ${(r * (1 - r)).toFixed(3)}.`,
        "forecast made   days right   first half   second half   closures caught   false alarms   Brier",
        ...leads.map(({ lead, odds, calls }) => {
          const c = calls.filter((d) => keep(d.date));
          const sc = ps.filter((p) => odds.has(p.at));
          return (
            `${(lead ? `${lead} day${lead > 1 ? "s" : ""} ahead` : "same day").padEnd(14)}  ${pc(right(c))}         ${pc(right(c.filter((d) => d.date < half)))}         ${pc(right(c.filter((d) => d.date >= half)))}` +
            `          ${String(c.filter((d) => d.warn && d.shut).length).padStart(2)} / ${shut}           ${String(c.filter((d) => d.warn && !d.shut).length).padStart(2)} / ${set.length - shut}       ${mean(sc.map((p) => (odds.get(p.at)! - Number(p.shut)) ** 2)).toFixed(3)}`
          );
        }),
      ];
    };
    console.log(
      [...table("All recorded days", () => true), "", ...table("Since the constants were frozen", (d) => d >= FROZEN_FROM)].join("\n"),
    );

    // If this fails after a change, the change made things worse.
    const shutShare = days.filter((d) => d.shut).length / days.length;
    for (const { lead, odds, calls } of leads.filter((x) => x.lead <= 2)) {
      expect(right(calls), `days right, ${lead}d ahead`).toBeGreaterThan(Math.max(shutShare, 1 - shutShare));
      const scored = polls.filter((p) => odds.has(p.at));
      expect(mean(scored.map((p) => (odds.get(p.at)! - Number(p.shut)) ** 2)), `Brier, ${lead}d ahead`).toBeLessThan(rate * (1 - rate));
    }
  });
});
