/**
 * Open-Meteo source layer.
 *
 * Fetches three feeds and folds them into per-hour consensus values plus the
 * disagreement between sources (which drives confidence):
 *  - marine:   multiple wave models        → waves/swell/period/direction + std
 *  - forecast: six deterministic NWP models → wind/gusts/pressure + cross-model std
 *  - ensemble: ECMWF 51-member ensemble     → wind ensemble std
 *
 * Everything downstream consumes the normalized RawHour[]; this is the only
 * module that knows Open-Meteo's URL shape and column-naming scheme.
 */

import { FORECAST_DAYS, GROTTO, HISTORY_DAYS, LOCATION, SOURCES } from "@/config/tuning";
import { PublicError } from "@/lib/errors";
import { mean, std } from "@/lib/forecast/math";
import type { RawHour, SourceMeta } from "@/lib/forecast/types";

const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble";

const FETCH_TIMEOUT_MS = 12_000;
/** Cache upstream responses for an hour (matches the page's refresh cadence). */
const REVALIDATE_S = 3600;

type Hourly = { time?: string[]; [column: string]: unknown };
type OpenMeteoResponse = { hourly?: Hourly; error?: boolean; reason?: string };

async function fetchJson(url: string): Promise<OpenMeteoResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_S },
    });
    if (!res.ok) {
      throw new PublicError(
        `The forecast service returned an error (${res.status}). It may be briefly down. Try again in a minute.`,
      );
    }
    const json = (await res.json()) as OpenMeteoResponse;
    if (json.error) {
      // `reason` is Open-Meteo's own text; log it, never relay it to visitors.
      console.error("[capri] open-meteo rejected a request:", json.reason);
      throw new PublicError("The forecast service rejected the request. Try again in a minute.");
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function buildUrl(base: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  return `${base}?${qs.toString()}`;
}

/* ----------------------------------------------------------- column helpers */

const num = (arr: unknown, i: number): number | null => {
  if (!Array.isArray(arr)) return null;
  const v = arr[i];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** Values of `base` across each model column (`base_model`), falling back to the
 *  bare `base` column for single-model responses. */
function acrossModels(
  h: Hourly,
  base: string,
  models: readonly string[],
  i: number,
): number[] {
  const out: number[] = [];
  for (const m of models) {
    const v = num(h[`${base}_${m}`], i);
    if (v != null) out.push(v);
  }
  if (!out.length) {
    const v = num(h[base], i);
    if (v != null) out.push(v);
  }
  return out;
}

/** All ensemble member values for `base` at hour `i` (control + memberNN). */
function ensembleValues(h: Hourly, base: string, i: number): number[] {
  const out: number[] = [];
  const control = num(h[base], i);
  if (control != null) out.push(control);
  for (let m = 1; m <= 50; m++) {
    const v = num(h[`${base}_member${String(m).padStart(2, "0")}`], i);
    if (v != null) out.push(v);
  }
  return out;
}

/** Circular mean of bearings (deg), correct across the 0/360 wrap. */
function circularMean(degs: number[]): number {
  if (!degs.length) return 0;
  let s = 0;
  let c = 0;
  for (const d of degs) {
    const r = (d * Math.PI) / 180;
    s += Math.sin(r);
    c += Math.cos(r);
  }
  return ((Math.atan2(s, c) * 180) / Math.PI + 360) % 360;
}

const indexByTime = (time?: string[]) => {
  const map = new Map<string, number>();
  (time ?? []).forEach((t, i) => map.set(t, i));
  return map;
};

/** How many ensemble members actually came back (for the source metadata). */
function countEnsembleMembers(h: Hourly, base: string): number {
  let n = Array.isArray(h[base]) ? 1 : 0;
  for (let m = 1; m <= 50; m++) {
    if (Array.isArray(h[`${base}_member${String(m).padStart(2, "0")}`])) n++;
  }
  return n;
}

/* ------------------------------------------------------------- normalization */

export function normalize(
  marine: OpenMeteoResponse,
  weather: OpenMeteoResponse,
  ensemble: OpenMeteoResponse,
): { raw: RawHour[]; meta: SourceMeta } {
  const mh = marine.hourly ?? {};
  const wh = weather.hourly ?? {};
  const eh = ensemble.hourly ?? {};
  const times = mh.time ?? [];
  const wIdx = indexByTime(wh.time);
  const eIdx = indexByTime(eh.time);
  const W = SOURCES.weatherModels;
  const M = SOURCES.waveModels;

  const raw: RawHour[] = times.map((t, i) => {
    const j = wIdx.get(t);
    const k = eIdx.get(t);

    // Marine consensus
    const waves = acrossModels(mh, "wave_height", M, i);
    const wave = waves.length ? mean(waves) : 0;
    const swells = acrossModels(mh, "swell_wave_height", M, i);
    const swell = swells.length ? mean(swells) : wave * 0.7;
    const swellPer = acrossModels(mh, "swell_wave_period", M, i);
    const wavePer = acrossModels(mh, "wave_period", M, i);
    const per = swellPer.length ? mean(swellPer) : wavePer.length ? mean(wavePer) : 5;
    // Weather consensus (j may be missing if the time axes differ)
    const winds = j != null ? acrossModels(wh, "wind_speed_10m", W, j) : [];
    const wind = winds.length ? mean(winds) : 0;
    const dirs = j != null ? acrossModels(wh, "wind_direction_10m", W, j) : [];

    const swellDir = acrossModels(mh, "swell_wave_direction", M, i);
    const waveDir = acrossModels(mh, "wave_direction", M, i);
    /*
     * Wind direction is the third choice because seas mostly run with the wind
     * and comes from different models, so it survives a marine outage. With no
     * direction at all, fall back to the grotto's own bearing: full exposure,
     * rather than a value that quietly argues in the cave's favour.
     */    const wDir = swellDir.length
      ? circularMean(swellDir)
      : waveDir.length
        ? circularMean(waveDir)
        : dirs.length
          ? circularMean(dirs)
          : GROTTO.faceBearing;

    const dir = dirs.length ? circularMean(dirs) : wDir;
    const gusts = j != null ? acrossModels(wh, "wind_gusts_10m", W, j) : [];
    const gust = gusts.length ? mean(gusts) : wind * 1.45;
    const presses = j != null ? acrossModels(wh, "pressure_msl", W, j) : [];
    const press = presses.length ? mean(presses) : 1015;
    const rains = j != null ? acrossModels(wh, "precipitation", W, j) : [];
    const rain = rains.length ? mean(rains) : 0;

    // Ensemble spread
    const ens = k != null ? ensembleValues(eh, "wind_speed_10m", k) : [];

    return {
      t,
      wind,
      dir,
      gust,
      press,
      rain,
      windModelStd: std(winds),
      windEnsembleStd: std(ens),
      wave,
      swell,
      per,
      wDir,
      waveModelStd: std(waves),
    };
  });

  const meta: SourceMeta = {
    weatherModels: [...W],
    ensembleModel: SOURCES.ensembleModel,
    ensembleMembers: countEnsembleMembers(eh, "wind_speed_10m"),
    waveModels: [...M],
  };

  return { raw, meta };
}

/* ---------------------------------------------------------------- fetch all */

/** Forecast/past window in days. */
interface Window {
  forecastDays: number;
  pastDays: number;
}

function windowParams({ forecastDays, pastDays }: Window): Record<string, string> {
  const p: Record<string, string> = { forecast_days: String(forecastDays) };
  if (pastDays > 0) p.past_days = String(pastDays);
  return p;
}

/** Fetch and normalize the feeds for a time window. Marine and weather are
 *  required; the ensemble is best-effort and can be skipped (history does). */
async function fetchWindow({
  forecastDays,
  pastDays,
  includeEnsemble,
}: Window & { includeEnsemble: boolean }) {
  const win = windowParams({ forecastDays, pastDays });
  const empty = { hourly: {} } as OpenMeteoResponse;

  const marineUrl = buildUrl(MARINE_URL, {
    latitude: String(LOCATION.marine.lat),
    longitude: String(LOCATION.marine.lon),
    hourly:
      "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction",
    timezone: LOCATION.timezone,
    models: SOURCES.waveModels.join(","),
    ...win,
  });
  const weatherUrl = buildUrl(FORECAST_URL, {
    latitude: String(LOCATION.island.lat),
    longitude: String(LOCATION.island.lon),
    hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation",
    wind_speed_unit: "kn",
    timezone: LOCATION.timezone,
    models: SOURCES.weatherModels.join(","),
    ...win,
  });
  const ensembleUrl = buildUrl(ENSEMBLE_URL, {
    latitude: String(LOCATION.island.lat),
    longitude: String(LOCATION.island.lon),
    hourly: "wind_speed_10m",
    wind_speed_unit: "kn",
    timezone: LOCATION.timezone,
    models: SOURCES.ensembleModel,
    ...win,
  });

  const [marine, weather, ensemble] = await Promise.all([
    fetchJson(marineUrl),
    fetchJson(weatherUrl),
    // Ensemble is an enrichment; degrade gracefully, and skip it entirely for history.
    includeEnsemble ? fetchJson(ensembleUrl).catch(() => empty) : Promise.resolve(empty),
  ]);

  return normalize(marine, weather, ensemble);
}

/** The forward forecast: FORECAST_DAYS ahead, with the ensemble. */
export function fetchSources() {
  return fetchWindow({ forecastDays: FORECAST_DAYS, pastDays: 0, includeEnsemble: true });
}

/** The window for the Blue Grotto timeline: HISTORY_DAYS back plus today and
 *  tomorrow (tomorrow feeds the "next day" forecast bar once today has closed),
 *  no ensemble. */
export function fetchHistory() {
  return fetchWindow({ forecastDays: 2, pastDays: HISTORY_DAYS, includeEnsemble: false });
}
