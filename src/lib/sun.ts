/**
 * Sunrise and sunset for a fixed point, from the NOAA sunrise equation. Pure
 * arithmetic, no network and no dependency, because the theme has to be decided
 * before the first paint (see THEME_SCRIPT in components/theme).
 *
 * A near-copy of `isDark` runs inline in the document head; the two are pinned
 * together by an equivalence test rather than shared code, since the inline copy
 * cannot import and the CSP forbids the eval that would let it.
 */

const RAD = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
/** Sun's centre 0.833° below the horizon: the standard refraction-corrected
 *  definition of sunrise, and what almanacs publish. */
const ZENITH = -0.833;

export interface SunTimes {
  /** UTC instant of sunrise, ms. */
  sunrise: number;
  /** UTC instant of sunset, ms. */
  sunset: number;
}

/**
 * Sunrise and sunset for the UTC calendar day containing `atMs`.
 *
 * The UTC day is deliberate: Capri is UTC+1/+2, so its civil date differs only
 * between midnight and 02:00 local, hours that are night under either date. Using
 * UTC keeps this free of timezone data, which matters for the inline copy.
 */
export function sunTimes(atMs: number, lat: number, lon: number): SunTimes {
  // Whole days since J2000.0. Taken at noon of the UTC day so the rounding is
  // never near a .5 boundary, whatever time of day `atMs` is.
  const noonOfDay = Math.floor(atMs / MS_PER_DAY) + 0.5;
  const n = Math.round(noonOfDay + 2440587.5 - 2451545 + 0.0008);
  // Mean solar noon at this longitude. Subtracted because the sun crosses an
  // eastern meridian before it crosses Greenwich: Capri's noon is ~57 min
  // earlier than UTC noon.
  const meanNoon = n - lon / 360;

  const anomaly = (357.5291 + 0.98560028 * meanNoon) % 360;
  const centre =
    1.9148 * Math.sin(anomaly * RAD) +
    0.02 * Math.sin(2 * anomaly * RAD) +
    0.0003 * Math.sin(3 * anomaly * RAD);
  const eclipticLon = (anomaly + centre + 180 + 102.9372) % 360;

  const transit =
    2451545 + meanNoon + 0.0053 * Math.sin(anomaly * RAD) - 0.0069 * Math.sin(2 * eclipticLon * RAD);

  const declination = Math.asin(Math.sin(eclipticLon * RAD) * Math.sin(23.44 * RAD));
  const cosHourAngle =
    (Math.sin(ZENITH * RAD) - Math.sin(lat * RAD) * Math.sin(declination)) /
    (Math.cos(lat * RAD) * Math.cos(declination));

  // |cos| > 1 means the sun never crosses the horizon that day (polar day or
  // night). Impossible at Capri's latitude, but clamping keeps the maths total.
  const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHourAngle))) / RAD;

  const toMs = (julian: number) => (julian - 2440587.5) * MS_PER_DAY;
  return {
    sunrise: toMs(transit - hourAngle / 360),
    sunset: toMs(transit + hourAngle / 360),
  };
}

/** Whether the sun is up at `atMs`. */
export function isDaylight(atMs: number, lat: number, lon: number): boolean {
  const { sunrise, sunset } = sunTimes(atMs, lat, lon);
  return atMs >= sunrise && atMs < sunset;
}

/**
 * The next moment the answer to `isDaylight` flips, so a page left open can
 * schedule its own change instead of polling.
 */
export function nextSunEvent(atMs: number, lat: number, lon: number): number {
  const { sunrise, sunset } = sunTimes(atMs, lat, lon);
  if (atMs < sunrise) return sunrise;
  if (atMs < sunset) return sunset;
  return sunTimes(atMs + MS_PER_DAY, lat, lon).sunrise;
}
