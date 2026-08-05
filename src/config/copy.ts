/**
 * ALL user-facing wording for the report, in one file.
 *
 * The forecast is generated from numbers by fixed rules, so the *wording*
 * changes as conditions do. Those conditional sentences, and the thresholds
 * that select between them, live here, not in the engine. Edit copy freely;
 * you can also re-tune where the wording flips (e.g. when the grotto line goes
 * from "borderline" to "shut") without touching logic.
 *
 * Numeric *model* tuning (what actually closes an activity) lives in ./tuning
 * and ./activities. This file only decides how conditions are described.
 */

import type { VerdictTone } from "./tuning";

export type ConfidenceTone = "high" | "medium" | "low";
export type GrottoStatus = "open" | "closed" | "unknown";
/** Live grotto chip states: capri.net's verdict plus an "outside opening hours" state. */
export type GrottoDisplayTone = "open" | "closed" | "offHours" | "unknown";
export type SlotTrend = "worse" | "better" | null;
export type PatternBand = "fallingFast" | "easing" | "building" | "steady";

/** Thresholds that decide which *sentence* is shown (wording, not model tuning). */
export const SUMMARY_THRESHOLDS = {
  grottoShut: 0.8,
  grottoRefuse: 0.55,
  grottoBorderline: 0.3,
  tourRough: 0.4,
} as const;

export const COPY = {
  meta: {
    title: "Capri Sea Tours: Reliability Forecast",
    description:
      "Will Capri's boat tours, the Blue Grotto and the ferries run today? An hourly, 7-day marine reliability forecast built from a multi-model weather ensemble.",
  },

  states: {
    loading: "Loading the marine forecast…",
    errorTitle: "Couldn't load the forecast",
    retry: "Retry",
    genericError: "No network connection.",
  },

  now: {
    title: "Capri, right now",
    seaDetails: "Sea details",
    refreshNote: "refreshes hourly",
    /** e.g. "Updated 09:20 Capri time · refreshes hourly" */
    updatedPrefix: "Updated",
    capriTimeSuffix: "Capri time",
    inCapriSuffix: "in Capri",
    minAgo: (mins: number) => `(${mins} min ago)`,
    statLabels: {
      waves: "Waves",
      swell: "Swell",
      period: "Period",
      wind: "Wind",
      gusts: "Gusts",
      grotto: "Blue Grotto",
    },
    grottoChanceClosed: "chance closed",
  },

  grottoBar: {
    title: "Blue Grotto live status",
    viewReport: "View report →",
    statusLabel: {
      open: "Open now",
      closed: "Closed now",
      offHours: "Closed",
      unknown: "Unknown",
    } satisfies Record<GrottoDisplayTone, string>,
    line: {
      open: "The grotto can be visited today, weather permitting. The boatmen make the final call at the cave.",
      weatherClosed: "Reported closed by sea conditions today. It can reopen the same day.",
      offHoursBeforeOpen: "Outside opening hours. Opens around 09:00.",
      offHoursAfterClose: "Closed for the day. Opens again tomorrow around 09:00.",
      unknown: "The live report couldn't be read right now.",
    },
    /** Shown when the live report is unreadable during opening hours. */
    fallback: (odds: string) =>
      `Live status unavailable. Our forecast puts it around ${odds} likely closed right now.`,
    /** Shown when we cross-checked more than one source and they disagree. */
    disagreement: "Live sources disagree, so treat this as provisional.",
  },

  grottoHistory: {
    title: "Blue Grotto, last 7 days",
    subtitle: "Open and closed through the day, opening hours only.",
    /** The time axis is generated from the days' opening hours; no fixed labels. */
    legend: { open: "Open", closed: "Closed", estimated: "Estimated", none: "No report" },
    /** Solid bars are the boatmen's reported calls; pale bars our forecast estimate. */
    modelNote:
      "Solid bars are the boatmen's reported calls; pale bars are our forecast estimate until the recorder is live.",
    /** Expanded-grid columns. `mobile: true` also shows on phones; the rest are
     *  tablet and up. Reorder, relabel, add or drop here. Each `key` must have a
     *  matching value produced by the history route. */
    columns: [
      { key: "waves", label: "Waves", mobile: false },
      { key: "swell", label: "Swell", mobile: true },
      { key: "period", label: "Period", mobile: true },
      { key: "from", label: "From", mobile: true },
      { key: "wind", label: "Wind", mobile: true },
      { key: "gusts", label: "Gusts", mobile: false },
      { key: "modeled", label: "Modeled", mobile: false },
    ],
    timeHeading: "Time",
    statusHeading: "Status",
    statusWord: { open: "Open", closed: "Closed" },
    noReport: "No report for this day.",
    empty: "History isn't available right now.",
  },

  today: {
    morning: { title: "This morning", sub: "09:00 – 13:00" },
    afternoon: { title: "This afternoon", sub: "13:00 – 18:00" },
    topHeading: "Chance of being closed or cancelled",
    topActivityLabels: {
      grotto: "Blue Grotto",
      tour: "Island boat tour",
      grottos: "White & Green grottos",
    },
  },

  sevenDay: {
    title: "Next 7 days",
    subtitle: "Dates follow Capri local time.",
    chanceOff: "Chance it's off",
    amLabel: "AM",
    pmLabel: "PM",
    numbersHeading: "The numbers (AM / PM)",
    numberLabels: {
      waves: "Waves",
      swell: "Swell",
      from: "From",
      period: "Period",
      wind: "Wind",
      gusts: "Gusts",
      pressure: "Pressure",
    },
    todayPrefix: "Today",
    tomorrowPrefix: "Tomorrow",
  },

  verdictLabel: {
    calm: "Calm",
    good: "Good",
    uncertain: "Uncertain",
    likelyOff: "Likely off",
    off: "Off",
  } satisfies Record<VerdictTone, string>,

  confidenceShort: {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
  } satisfies Record<ConfidenceTone, string>,

  /**
   * The plain-language sea summary ("sailor line"). This is the single set of
   * rules the methodology section describes. Keep the two in sync if you edit
   * the thresholds.
   */
  sailorLine({
    grotto,
    tour,
    northerly,
  }: {
    grotto: number;
    tour: number;
    northerly: boolean;
  }): string {
    const t = SUMMARY_THRESHOLDS;
    if (grotto > t.grottoShut) {
      return northerly
        ? "Swell is hitting the cave head-on. The Blue Grotto is almost certainly shut."
        : "Too much water at the cave entrance. The Blue Grotto is almost certainly shut, and small boats will be bouncing.";
    }
    if (grotto > t.grottoRefuse)
      return "Rough at the Blue Grotto. The boatmen often refuse entry in these conditions.";
    if (grotto > t.grottoBorderline)
      return "Borderline at the Blue Grotto. Likely open, but it's a judgment call at the cave.";
    if (tour > t.tourRough)
      return "The Blue Grotto looks fine, but the wind makes boat trips rough.";
    return "Calm sea and light wind. No weather closures expected.";
  },

  /** Appended to a day's summary when one half of the day is clearly worse. */
  slotTrendNote(trend: SlotTrend): string {
    if (trend === "worse") return " Turns worse after lunch.";
    if (trend === "better") return " Better in the afternoon.";
    return "";
  },

  patternLine({ band, pressHpa }: { band: PatternBand; pressHpa: number }): string {
    switch (band) {
      case "fallingFast":
        return "Pressure is falling fast. A weather system is moving in.";
      case "easing":
        return "Pressure is easing off. Conditions may change tonight.";
      case "building":
        return "Pressure is building. Conditions are settling.";
      default:
        return `Steady pressure (${Math.round(pressHpa)} hPa). No big change coming.`;
    }
  },

  confidenceLine({ tone, farOut }: { tone: ConfidenceTone; farOut: boolean }): string {
    if (farOut && tone !== "high")
      return "Low confidence this far out. Forecasts firm up 2–3 days ahead.";
    if (tone === "high") return "High confidence. The models and ensemble agree.";
    if (tone === "medium")
      return "Medium confidence. This can still shift before the day.";
    return "Low confidence. Too far out, or the models disagree.";
  },

  dayWhyLine({
    closes,
    fromLabel,
    spreadWarn,
    pressureWarn,
  }: {
    closes: boolean;
    fromLabel: string;
    spreadWarn: boolean;
    pressureWarn: boolean;
  }): string {
    const base = closes
      ? `Swell is arriving from the ${fromLabel}, the direction that closes the Blue Grotto.`
      : "Swell direction is away from the grotto's northwest-facing mouth, which helps it stay open.";
    // Kept qualitative on purpose: the confidence spread is a blended metric
    // (wind models + ensemble + waves), not a literal wind delta in knots.
    const spread = spreadWarn
      ? " The forecast sources disagree here, so treat the wind figure loosely."
      : "";
    const pressure = pressureWarn
      ? " Pressure drops through the day, so conditions may worsen faster than shown."
      : "";
    return base + spread + pressure;
  },

  /**
   * "How this page works". Structured so the UI renders it and it stays fully
   * editable. Inline emphasis uses **double asterisks**; links are [text](url).
   */
  methodology: {
    title: "How this page works",
    sections: [
      {
        lead: "The data.",
        body:
          "Waves, swell height, period and direction come from Open-Meteo's marine models (ECMWF WAM, GWAM, Météo-France and NCEP WaveWatch), blended together. Wind, gusts and pressure come from six forecast models (ECMWF, GFS, ICON, GEM, Météo-France and UKMO) plus ECMWF's 51-member ensemble. All of it is hourly, 7 days out. Morning = the 09:00–13:00 hours averaged, afternoon = 13:00–18:00. The page re-fetches every hour on its own.",
      },
      {
        lead: "The percentages.",
        body:
          "Each one is the chance that activity is closed or cancelled in that time slot. Every activity has its own breaking point: the Blue Grotto's mouth is barely a metre high, so it closes once swell lifts the entrance water 30–40 cm. It faces northwest, so N/NW/WNW swell or wind hits it head-on while a southerly barely reaches it. Boat tours give up around 1.2 m or 18 kt. Hydrofoils cancel before car ferries; Amalfi Coast routes before both.",
      },
      {
        lead: "The verdict chips.",
        body:
          "Calm (under 13% chance sea activities are cancelled), Good (to 30%), Uncertain (to 50%), Likely off (to 72%), Off (above). The figure weighs the Blue Grotto at 62% and a boat tour at 38%, since those are the plans that break first.",
      },
      {
        lead: "The confidence line.",
        body:
          "Starts high and drops with each day further out, when the forecast models and the ensemble disagree on wind, when pressure is falling fast (a system moving in), and when conditions sit right on a threshold. Pulling in six models plus a 51-member ensemble means disagreement is measured across many independent forecasts, not just two. It's about the forecast, never about how open something is.",
      },
      {
        lead: "The written summaries.",
        body:
          "Generated from the numbers by fixed rules, so the wording changes as conditions do: grotto odds above 80% closed produce a \"shut\" line, 55–80% a \"boatmen often refuse\" line, 30–55% a \"borderline\" line, and below that a calm line or a wind warning for boat trips. A note is appended when the afternoon is meaningfully better or worse than the morning.",
      },
    ],
    roughSeas: {
      title: "How rough seas play out here",
      points: [
        "Hydrofoils are cancelled first; car ferries keep running in much rougher water.",
        "Sorrento is the shortest, most sheltered crossing. Positano and Amalfi routes are cancelled long before it.",
        "Marina Piccola and the Faraglioni sit on the sheltered south side in a northerly.",
        "The grotto can stay closed for several days in a row once a northerly swell sets in.",
        "Land attractions (Monte Solaro, Villa Jovis, Gardens of Augustus) are unaffected by sea state.",
      ],
    },
    sources: {
      title: "Official sources",
      intro: "The final call on the grotto is made by the boatmen at the cave mouth around 09:00 each day.",
      contacts: [
        { label: "Motoscafisti, Marina Grande", value: "+39 081 837 5646", note: "(after 09:00)" },
        { label: "Capri tourist info", value: "+39 081 837 0686", note: "" },
      ],
      links: [
        { label: "Windy waves", href: "https://www.windy.com/40.554/14.222?waves,40.554,14.222,10" },
        { label: "Windfinder", href: "https://www.windfinder.com/forecast/capri" },
        { label: "Grotto status (capri.net)", href: "https://www.capri.net/en/e/la-grotta-azzurra" },
        { label: "CoopCulture (official tickets)", href: "https://www.coopculture.it/en/poi/blue-grotto/" },
        { label: "Open/closed light", href: "https://www.bluegrotto.tours/opening-times/" },
      ],
    },
    disclaimer:
      "Guidance only, not a navigational forecast. The boatmen and the port authority have the final word.",
    lastUpdatedPrefix: "Last updated",
  },

  grottoReportUrl: "https://www.capri.net/en/e/la-grotta-azzurra",
} as const;
