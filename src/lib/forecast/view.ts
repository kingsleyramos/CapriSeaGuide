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
  SLOT_HOURS,
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

/** Capri-local calendar day, for "is this the same day" comparisons. */
const capriDay = (d: Date, timezone: string) =>
  d.toLocaleDateString("en-CA", { timeZone: timezone });

/** e.g. "6 Aug" -- only ever shown alongside a time from another day. */
const fmtDayMonth = (d: Date, timezone: string) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: timezone });

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
  /** Our modeled grotto closure probability for the current hour (0-1). */
  grottoProbNow: number;
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
  // Name the day when the reading is not from today. Without it the line is a
  // bare clock time, so yesterday's 06:31 reads as half an hour into the future
  // next to a 06:06 clock -- the one reading that is obviously broken is the one
  // that looked fine.
  const sameDay = capriDay(at, timezone) === capriDay(now, timezone);
  const updatedLine =
    `${fmtTime(at, timezone)} ` +
    (sameDay ? "" : `${c.onDate(fmtDayMonth(at, timezone))} `) +
    c.capriTimeSuffix +
    (mins > REFRESH.agoThresholdMin ? ` ${c.ago(mins)}` : "");

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
    grottoProbNow: cur.probs.grotto,
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
  key: "morning" | "afternoon";
  title: string;
  sub: string;
  verdict: VerdictView;
  line: string;
  confidence: ConfidenceView;
  top: OddsView[];
}

const AFTERNOON_END_HOUR = Math.max(...SLOT_HOURS.afternoon) + 1;

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Capri wall-clock time for a real instant. */
const capriWall = (now: Date, timezone: string) =>
  new Date(now.toLocaleString("en-US", { timeZone: timezone }));

/**
 * Which day the "today" cards should describe. After the afternoon slot ends
 * (18:00 Capri) the cards roll to tomorrow -- "This morning" must not label a
 * morning that is already over. Matching by date rather than taking days[0]
 * also survives a report cached across midnight, where days[0] is yesterday.
 */
export function pickTodayCardsDay(
  days: DayForecast[],
  now: Date,
  timezone: string = LOCATION.timezone,
): { day: DayForecast; isTomorrow: boolean } | null {
  const wall = capriWall(now, timezone);
  const todayDate = isoDate(wall);

  let i = days.findIndex((d) => d.date >= todayDate);
  if (i === -1) return null;
  if (days[i].date === todayDate && wall.getHours() >= AFTERNOON_END_HOUR && days[i + 1]) {
    i += 1;
  }
  return { day: days[i], isTomorrow: days[i].date !== todayDate };
}

export function buildTodayCards(
  days: DayForecast[],
  now: Date,
  timezone: string = LOCATION.timezone,
): TodayCardView[] {
  const picked = pickTodayCardsDay(days, now, timezone);
  if (!picked) return [];
  const { day: today, isTomorrow } = picked;
  const defs = [
    { key: "morning" as const, ...(isTomorrow ? COPY.today.tomorrowMorning : COPY.today.morning) },
    {
      key: "afternoon" as const,
      ...(isTomorrow ? COPY.today.tomorrowAfternoon : COPY.today.afternoon),
    },
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
  morningPct: string;
  afternoonPct: string;
  morningTone: PillTone | "none";
  afternoonTone: PillTone | "none";
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
  morning: VerdictView;
  afternoon: VerdictView;
  activities: DayActivityRow[];
  numbers: DayNumberRow[];
  why: string;
}

/** "Today"/"Tomorrow" come from the client clock, not the report's `lead`:
 *  a report cached across midnight would otherwise label yesterday "Today". */
const dayLabel = (date: string, now: Date, timezone: string) => {
  const full = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const wall = capriWall(now, timezone);
  if (date === isoDate(wall)) return `${COPY.sevenDay.todayPrefix} · ${full}`;
  wall.setDate(wall.getDate() + 1);
  if (date === isoDate(wall)) return `${COPY.sevenDay.tomorrowPrefix} · ${full}`;
  return full;
};

const trend = (day: DayForecast) => {
  const { morning, afternoon } = day;
  if (morning && afternoon && afternoon.head > morning.head + SLOT_DELTA_NOTE) {
    return "worse" as const;
  }
  if (morning && afternoon && morning.head > afternoon.head + SLOT_DELTA_NOTE) {
    return "better" as const;
  }
  return null;
};

export function buildDayRow(
  day: DayForecast,
  now: Date,
  timezone: string = LOCATION.timezone,
): DayRowView | null {
  // A day with hours but none in the AM/PM windows has no summary to build.
  // Open-Meteo returns full local days so this is defensive, not expected.
  if (!day.morning && !day.afternoon) return null;
  const s = day.morning ?? day.afternoon!;
  const L = COPY.sevenDay.numberLabels;
  const pair = (f: (slot: Slot) => string) =>
    `${day.morning ? f(day.morning) : "—"} / ${day.afternoon ? f(day.afternoon) : "—"}`;

  return {
    date: day.date,
    label: dayLabel(day.date, now, timezone),
    line: sailorLine(s) + COPY.slotTrendNote(trend(day)),
    confidence: confidenceView(s, day.lead),
    morning: verdictOrDash(day.morning),
    afternoon: verdictOrDash(day.afternoon),
    activities: ACTIVITIES.map((a) => ({
      key: a.key,
      name: a.name,
      morningPct: day.morning ? pct(day.morning.p[a.key]) : "—",
      afternoonPct: day.afternoon ? pct(day.afternoon.p[a.key]) : "—",
      morningTone: day.morning ? pillTone(day.morning.p[a.key]) : "none",
      afternoonTone: day.afternoon ? pillTone(day.afternoon.p[a.key]) : "none",
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
