/**
 * View layer: turns the numeric forecast into display-ready view-models using
 * the centralized copy. This is the ONLY place model numbers become sentences,
 * and it runs at render time so time-relative wording ("3 min ago", "Today")
 * stays live. Colors never cross this boundary. Components map the semantic
 * `tone` values to design-system classes.
 */

import { type ActivityKey, ACTIVITIES, TODAY_TOP_ACTIVITIES } from "@/config/activities";
import { COPY, type ConfidenceTone } from "@/config/copy";
import {
  GROTTO_CLOSING_DIRS,
  LOCATION,
  NORTHERLY_SAILOR,
  REFRESH,
  SLOT_DELTA_NOTE,
  WHY_PRESSURE_WARN,
  WHY_SPREAD_WARN,
  type NowTone,
  type PillTone,
  type VerdictTone,
} from "@/config/tuning";
import { buildSlot } from "./aggregate";
import { compass, pct } from "./math";
import {
  confidenceTone,
  isFarLead,
  nowTintTone,
  patternBand,
  pillTone,
  verdictTone,
} from "./model";
import type { CompactHour, DayForecast, Slot } from "./types";

export type DisplayTone = VerdictTone | "none";

export interface VerdictView {
  tone: DisplayTone;
  label: string;
}
export interface ConfidenceView {
  tone: ConfidenceTone;
  line: string;
  short: string;
}
export interface StatView {
  label: string;
  value: string;
}
export interface OddsView {
  key: string;
  name: string;
  pct: string;
  tone: PillTone;
}

/* ------------------------------------------------------------------ helpers */

const fmtTime = (d: Date, timezone: string) =>
  d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });

const northerly = (wDir: number) =>
  (NORTHERLY_SAILOR as readonly string[]).includes(compass(wDir));

/** The plain-language sea summary for a slot. */
export const sailorLine = (s: Slot) =>
  COPY.sailorLine({
    grotto: s.p.grotto,
    tour: s.p.tour,
    northerly: northerly(s.wDir),
  });

export const verdictView = (head: number): VerdictView => {
  const tone = verdictTone(head);
  return { tone, label: COPY.verdictLabel[tone] };
};

/** Verdict for a possibly-empty slot; renders a dash when there's no data. */
export const verdictOrDash = (slot: Slot | null): VerdictView =>
  slot ? verdictView(slot.head) : { tone: "none", label: "—" };

export const confidenceView = (slot: Slot, lead: number): ConfidenceView => {
  const tone = confidenceTone(slot.conf);
  return {
    tone,
    line: COPY.confidenceLine({ tone, farOut: isFarLead(lead, slot.conf) }),
    short: COPY.confidenceShort[tone],
  };
};

/* --------------------------------------------------------------- now card */

/** Pick the forecast hour whose Capri wall-clock time is closest to now. */
export function pickCurrentHour(
  hours: CompactHour[],
  now: Date,
  timezone: string = LOCATION.timezone,
): CompactHour {
  const wall = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const target = new Date(
    wall.getFullYear(),
    wall.getMonth(),
    wall.getDate(),
    wall.getHours(),
  ).getTime();
  let best = Infinity;
  let cur = hours[0];
  for (const h of hours) {
    const diff = Math.abs(new Date(h.t).getTime() - target);
    if (diff < best) {
      best = diff;
      cur = h;
    }
  }
  return cur;
}

export interface NowView {
  verdict: VerdictView;
  tint: NowTone;
  headline: string;
  pattern: string;
  stats: StatView[];
  /** "Updated 09:20 Capri time (5 min ago)". Excludes the "Updated" prefix. */
  updatedLine: string;
  /** "Sunday, 3 August · 09:20 in Capri" */
  capriNowLine: string;
}

export function buildNowView(
  hours: CompactHour[],
  fetchedAt: number,
  now: Date,
  timezone: string,
): NowView {
  const cur = pickCurrentHour(hours, now, timezone);
  const slot = buildSlot([cur], 0)!;
  const c = COPY.now;

  const mins = Math.round((now.getTime() - fetchedAt) / 60000);
  const at = new Date(fetchedAt);
  const updatedLine =
    `${fmtTime(at, timezone)} ${c.capriTimeSuffix}` +
    (mins > REFRESH.agoThresholdMin ? ` ${c.minAgo(mins)}` : "");

  const capriNowLine =
    now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    }) +
    ` · ${fmtTime(now, timezone)} ${c.inCapriSuffix}`;

  return {
    verdict: verdictView(slot.head),
    tint: nowTintTone(slot.head),
    headline: sailorLine(slot),
    pattern: COPY.patternLine({ band: patternBand(cur.dp), pressHpa: cur.press }),
    updatedLine,
    capriNowLine,
    stats: [
      { label: c.statLabels.waves, value: `${cur.wave.toFixed(1)} m` },
      { label: c.statLabels.swell, value: `${cur.swell.toFixed(1)} m ${compass(cur.wDir)}` },
      { label: c.statLabels.period, value: `${Math.round(cur.per)} s` },
      { label: c.statLabels.wind, value: `${Math.round(cur.wind)} kt ${compass(cur.dir)}` },
      { label: c.statLabels.gusts, value: `${Math.round(cur.gust)} kt` },
      { label: c.statLabels.grotto, value: `${pct(cur.probs.grotto)} ${c.grottoChanceClosed}` },
    ],
  };
}

/* -------------------------------------------------------------- today cards */

export interface TodayCardView {
  key: "am" | "pm";
  title: string;
  sub: string;
  verdict: VerdictView;
  line: string;
  confidence: ConfidenceView;
  top: OddsView[];
}

export function buildTodayCards(today: DayForecast | undefined): TodayCardView[] {
  if (!today) return [];
  const defs = [
    { key: "am" as const, ...COPY.today.morning },
    { key: "pm" as const, ...COPY.today.afternoon },
  ];
  const cards: TodayCardView[] = [];
  for (const def of defs) {
    const slot = today[def.key];
    if (!slot) continue;
    cards.push({
      key: def.key,
      title: def.title,
      sub: def.sub,
      verdict: verdictView(slot.head),
      line: sailorLine(slot),
      confidence: confidenceView(slot, today.lead),
      top: TODAY_TOP_ACTIVITIES.map((key) => ({
        key,
        name: COPY.today.topActivityLabels[key],
        pct: pct(slot.p[key]),
        tone: pillTone(slot.p[key]),
      })),
    });
  }
  return cards;
}

/* ----------------------------------------------------------- seven-day rows */

export interface DayActivityRow {
  key: ActivityKey;
  name: string;
  amPct: string;
  pmPct: string;
  amTone: PillTone | "none";
  pmTone: PillTone | "none";
}
export interface DayNumberRow {
  label: string;
  value: string;
}
export interface DayRowView {
  date: string;
  label: string;
  line: string;
  confidence: ConfidenceView;
  am: VerdictView;
  pm: VerdictView;
  activities: DayActivityRow[];
  numbers: DayNumberRow[];
  why: string;
}

const dayLabel = (date: string, lead: number) => {
  const full = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  if (lead === 0) return `${COPY.sevenDay.todayPrefix} · ${full}`;
  if (lead === 1) return `${COPY.sevenDay.tomorrowPrefix} · ${full}`;
  return full;
};

const trend = (day: DayForecast) => {
  const { am, pm } = day;
  if (am && pm && pm.head > am.head + SLOT_DELTA_NOTE) return "worse" as const;
  if (am && pm && am.head > pm.head + SLOT_DELTA_NOTE) return "better" as const;
  return null;
};

export function buildDayRow(day: DayForecast): DayRowView | null {
  // A day with hours but none in the AM/PM windows has no summary to build.
  // Open-Meteo returns full local days so this is defensive, not expected.
  if (!day.am && !day.pm) return null;
  const s = day.am ?? day.pm!;
  const L = COPY.sevenDay.numberLabels;
  const pair = (f: (slot: Slot) => string) =>
    `${day.am ? f(day.am) : "—"} / ${day.pm ? f(day.pm) : "—"}`;

  return {
    date: day.date,
    label: dayLabel(day.date, day.lead),
    line: sailorLine(s) + COPY.slotTrendNote(trend(day)),
    confidence: confidenceView(s, day.lead),
    am: verdictOrDash(day.am),
    pm: verdictOrDash(day.pm),
    activities: ACTIVITIES.map((a) => ({
      key: a.key,
      name: a.name,
      amPct: day.am ? pct(day.am.p[a.key]) : "—",
      pmPct: day.pm ? pct(day.pm.p[a.key]) : "—",
      amTone: day.am ? pillTone(day.am.p[a.key]) : "none",
      pmTone: day.pm ? pillTone(day.pm.p[a.key]) : "none",
    })),
    numbers: [
      { label: L.waves, value: pair((x) => `${x.wave.toFixed(1)} m`) },
      { label: L.swell, value: pair((x) => `${x.swell.toFixed(1)} m`) },
      { label: L.from, value: pair((x) => compass(x.wDir)) },
      { label: L.period, value: pair((x) => `${Math.round(x.per)} s`) },
      { label: L.wind, value: pair((x) => `${Math.round(x.wind)} kt ${compass(x.dir)}`) },
      { label: L.gusts, value: pair((x) => `${Math.round(x.gust)} kt`) },
      { label: L.pressure, value: pair((x) => `${Math.round(x.press)} hPa`) },
    ],
    why: COPY.dayWhyLine({
      closes: (GROTTO_CLOSING_DIRS as readonly string[]).includes(compass(s.wDir)),
      fromLabel: compass(s.wDir),
      spreadWarn: s.spread > WHY_SPREAD_WARN,
      pressureWarn: s.dp < WHY_PRESSURE_WARN,
    }),
  };
}
