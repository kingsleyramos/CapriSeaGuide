import { describe, expect, it } from "vitest";
import { LOCATION } from "@/config/tuning";
import { THEME_SCRIPT } from "@/components/theme/theme-script";
import { isDaylight, nextSunEvent, sunTimes } from "./sun";

const { lat, lon } = LOCATION.island;

describe("sunTimes", () => {
  // Cross-checked against Open-Meteo's own sunrise/sunset for these coordinates
  // (queried with timezone=UTC, so no DST ambiguity). Asserted in UTC for the
  // same reason. Tolerance 2 min: this equation ignores elevation and the local
  // horizon, and measured within 1 min of Open-Meteo on every date below.
  const cases = [
    { date: "2025-03-20", sunrise: "05:05", sunset: "17:14" }, // equinox
    { date: "2025-06-21", sunrise: "03:32", sunset: "18:37" }, // summer solstice
    { date: "2025-09-23", sunrise: "04:51", sunset: "16:58" }, // equinox
    { date: "2025-12-21", sunrise: "06:23", sunset: "15:39" }, // winter solstice
    { date: "2025-01-15", sunrise: "06:24", sunset: "16:00" },
  ];

  const utcHhMm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
  const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

  for (const c of cases) {
    it(`is within 2 minutes of Open-Meteo on ${c.date}`, () => {
      const { sunrise, sunset } = sunTimes(Date.parse(`${c.date}T12:00:00Z`), lat, lon);
      expect(Math.abs(minutes(utcHhMm(sunrise)) - minutes(c.sunrise))).toBeLessThanOrEqual(2);
      expect(Math.abs(minutes(utcHhMm(sunset)) - minutes(c.sunset))).toBeLessThanOrEqual(2);
    });
  }

  it("puts sunrise before sunset, every day of a year", () => {
    for (let d = 0; d < 365; d++) {
      const at = Date.parse("2026-01-01T12:00:00Z") + d * 86_400_000;
      const { sunrise, sunset } = sunTimes(at, lat, lon);
      expect(sunset).toBeGreaterThan(sunrise);
    }
  });
});

describe("isDaylight", () => {
  it("is dark at midnight and light at midday", () => {
    expect(isDaylight(Date.parse("2026-08-06T00:30:00Z"), lat, lon)).toBe(false);
    expect(isDaylight(Date.parse("2026-08-06T12:00:00Z"), lat, lon)).toBe(true);
  });

  it("flips either side of sunset", () => {
    const { sunset } = sunTimes(Date.parse("2026-08-06T12:00:00Z"), lat, lon);
    expect(isDaylight(sunset - 60_000, lat, lon)).toBe(true);
    expect(isDaylight(sunset + 60_000, lat, lon)).toBe(false);
  });

  it("answers for the Capri sun regardless of where the reader is", () => {
    // 02:00 in Tokyo is 18:00 in Capri on this date: still light.
    const at = Date.parse("2026-08-06T17:00:00Z");
    expect(isDaylight(at, lat, lon)).toBe(true);
  });
});

describe("nextSunEvent", () => {
  it("returns sunrise before dawn, sunset during the day", () => {
    const noon = Date.parse("2026-08-06T12:00:00Z");
    const { sunrise, sunset } = sunTimes(noon, lat, lon);
    expect(nextSunEvent(sunrise - 60_000, lat, lon)).toBe(sunrise);
    expect(nextSunEvent(noon, lat, lon)).toBe(sunset);
  });

  it("rolls to tomorrow's sunrise after dark", () => {
    const noon = Date.parse("2026-08-06T12:00:00Z");
    const { sunset } = sunTimes(noon, lat, lon);
    const next = nextSunEvent(sunset + 60_000, lat, lon);
    expect(next).toBeGreaterThan(sunset);
    expect(next).toBe(sunTimes(noon + 86_400_000, lat, lon).sunrise);
  });

  it("is always in the future, sampled across a year", () => {
    for (let d = 0; d < 365; d++) {
      for (const hour of [0, 6, 12, 18, 23]) {
        const at = Date.parse("2026-01-01T00:00:00Z") + d * 86_400_000 + hour * 3_600_000;
        expect(nextSunEvent(at, lat, lon)).toBeGreaterThan(at);
      }
    }
  });
});

describe("inline script agrees with the module", () => {
  // The head script is a hand-inlined copy: it cannot import, and the CSP has no
  // 'unsafe-eval' for it to build one at runtime. This is what keeps them honest.
  it("returns the same answer at every hour of a year", () => {
    const evaluate = new Function(
      "nowMs",
      `${THEME_SCRIPT.replace("document.documentElement.dataset.theme=t", "return t")}`,
    ) as (nowMs: number) => string;

    for (let d = 0; d < 365; d++) {
      for (let hour = 0; hour < 24; hour++) {
        const at = Date.parse("2026-01-01T00:00:00Z") + d * 86_400_000 + hour * 3_600_000;
        const fromModule = isDaylight(at, lat, lon) ? "light" : "dark";
        expect(evaluate(at), `at ${new Date(at).toISOString()}`).toBe(fromModule);
      }
    }
  });
});

describe("stored override", () => {
  // The head script must honour a saved choice, or a reader who picked light
  // watches the page load dark and correct itself.
  const run = (nowMs: number, stored: string | null) => {
    const fn = new Function(
      "nowMs",
      "localStorage",
      `${THEME_SCRIPT.replace(/document\.documentElement\.dataset\.theme=(o|t)/g, "return $1")}`,
    ) as (nowMs: number, ls: { getItem: () => string | null }) => string;
    return fn(nowMs, { getItem: () => stored });
  };

  const night = Date.parse("2026-08-06T00:30:00Z");
  const day = Date.parse("2026-08-06T12:00:00Z");

  it("follows the sun when nothing is stored", () => {
    expect(run(night, null)).toBe("dark");
    expect(run(day, null)).toBe("light");
  });

  it("lets a stored choice beat the sun, both ways", () => {
    expect(run(night, "light")).toBe("light");
    expect(run(day, "dark")).toBe("dark");
  });

  it("ignores a junk value rather than trusting it", () => {
    expect(run(day, "banana")).toBe("light");
  });
});
