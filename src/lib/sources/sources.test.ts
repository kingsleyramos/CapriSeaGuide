import { describe, expect, it } from "vitest";
import { parseBlueGrotto, parseCapriNet } from "./grotto";
import { normalize } from "./open-meteo";

/* ------------------------------------------------------------- open-meteo */

const marine = {
  hourly: {
    time: ["2026-08-03T00:00", "2026-08-03T01:00"],
    wave_height_ecmwf_wam025: [0.4, 0.5],
    wave_height_gwam: [0.6, 0.7],
    swell_wave_height_ecmwf_wam025: [0.3, 0.35],
    swell_wave_period_ecmwf_wam025: [6, 6],
    // Directions straddling the 0/360 wrap, one per model.
    swell_wave_direction_ecmwf_wam025: [350, 350],
    swell_wave_direction_gwam: [10, 10],
  },
};
const weather = {
  hourly: {
    time: ["2026-08-03T00:00", "2026-08-03T01:00"],
    wind_speed_10m_ecmwf_ifs025: [10, 12],
    wind_speed_10m_gfs_seamless: [14, 16],
    wind_direction_10m_ecmwf_ifs025: [200, 200],
    wind_gusts_10m_ecmwf_ifs025: [18, 20],
    pressure_msl_ecmwf_ifs025: [1015, 1014],
  },
};
const ensemble = {
  hourly: {
    time: ["2026-08-03T00:00", "2026-08-03T01:00"],
    wind_speed_10m: [10, 12],
    wind_speed_10m_member01: [11, 13],
    wind_speed_10m_member02: [9, 11],
  },
};

describe("normalize()", () => {
  it("averages waves across models and measures disagreement", () => {
    const { raw, meta } = normalize(marine, weather, ensemble);
    expect(raw).toHaveLength(2);
    expect(raw[0].wave).toBeCloseTo(0.5, 6); // mean(0.4, 0.6)
    expect(raw[0].waveModelStd).toBeCloseTo(0.1, 6); // std(0.4, 0.6)
    expect(raw[0].windModelStd).toBeGreaterThan(0); // ECMWF vs GFS differ
    expect(raw[0].windEnsembleStd).toBeGreaterThan(0);
    expect(meta.ensembleMembers).toBe(3); // control + 2 members
  });

  it("circular-means directions across the 0/360 wrap (not through 180)", () => {
    const { raw } = normalize(marine, weather, ensemble);
    // 350° and 10° should average to ~0° (N), never ~180° (S).
    expect(Math.min(raw[0].wDir, 360 - raw[0].wDir)).toBeLessThan(1);
  });

  it("falls back safely when a weather hour is missing", () => {
    const misaligned = { hourly: { ...weather.hourly, time: ["2026-08-03T05:00"] } };
    const { raw } = normalize(marine, misaligned, ensemble);
    expect(raw[0].wind).toBe(0); // no matching weather hour
    expect(raw[0].press).toBe(1015); // documented default
  });
});

/* ---------------------------------------------------------------- grotto */

describe("parseCapriNet()", () => {
  it("reads the live closed banner", () => {
    expect(parseCapriNet("<p>The grotto is closed at the moment until…</p>")).toBe("closed");
  });
  it("reads open when only the visit template is present", () => {
    expect(
      parseCapriNet('<script>openTitle:"The grotto can be visited today, {d}"</script>'),
    ).toBe("open");
  });
  it("the closed banner wins even when the open template also appears", () => {
    expect(
      parseCapriNet('grotto is closed at the moment … later "grotto can be visited today"'),
    ).toBe("closed");
  });
  it("returns unknown when neither phrase is present", () => {
    expect(parseCapriNet("<p>Welcome to the island of Capri.</p>")).toBe("unknown");
  });
});

describe("parseBlueGrotto()", () => {
  it("ignores stray green/red imagery (no false positives)", () => {
    expect(
      parseBlueGrotto('<img src="/theme/green-logo.svg"><img alt="red arrow icon">'),
    ).toBe("unknown");
  });
  it("trusts a status-scoped light image", () => {
    expect(parseBlueGrotto('<img src="/status-light-green.png" alt="open">')).toBe("open");
    expect(parseBlueGrotto('<img src="/traffic-light-red.png">')).toBe("closed");
  });
});
