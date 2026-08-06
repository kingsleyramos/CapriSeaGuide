/**
 * Sunrise and sunset from the NOAA sunrise equation. Deliberately pure
 * arithmetic: the theme is decided before the first paint, where a fetch cannot
 * reach. components/theme/theme-script holds an inlined copy, pinned to this one
 * by an equivalence test.
 */

const RAD = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
/** Sun's centre 0.833° below the horizon: the refraction-corrected definition
 *  almanacs publish. */
const ZENITH = -0.833;

/** Both are UTC instants in ms. */
export interface SunTimes {
  sunrise: number;
  sunset: number;
}

/**
 * Sunrise and sunset for the UTC calendar day containing `atMs`. The UTC day,
 * not Capri's: the two differ only between midnight and 02:00 local, which is
 * night either way, and it keeps this free of timezone data for the inlined copy.
 */
export function sunTimes(atMs: number, lat: number, lon: number): SunTimes {
  // Noon of the UTC day, so the rounding below is never near a .5 boundary.
  const noonOfDay = Math.floor(atMs / MS_PER_DAY) + 0.5;
  const n = Math.round(noonOfDay + 2440587.5 - 2451545 + 0.0008);
  // Subtracted, not added: an eastern meridian meets the sun before Greenwich
  // does, so Capri's solar noon is ~57 min before UTC noon.
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

  // |cos| > 1 is polar day or night: impossible here, but clamping keeps the
  // maths total.
  const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHourAngle))) / RAD;

  const toMs = (julian: number) => (julian - 2440587.5) * MS_PER_DAY;
  return {
    sunrise: toMs(transit - hourAngle / 360),
    sunset: toMs(transit + hourAngle / 360),
  };
}

export function isDaylight(atMs: number, lat: number, lon: number): boolean {
  const { sunrise, sunset } = sunTimes(atMs, lat, lon);
  return atMs >= sunrise && atMs < sunset;
}

/** The next moment `isDaylight` flips, so a page can sleep rather than poll. */
export function nextSunEvent(atMs: number, lat: number, lon: number): number {
  const { sunrise, sunset } = sunTimes(atMs, lat, lon);
  if (atMs < sunrise) return sunrise;
  if (atMs < sunset) return sunset;
  return sunTimes(atMs + MS_PER_DAY, lat, lon).sunrise;
}
