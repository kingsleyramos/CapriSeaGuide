const RAD = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

/**
 * How aligned the moon and sun are, +1 at new and full moon (their tides add up)
 * and -1 at the quarters. Low-precision Meeus series, good to a few hours.
 */
export function springIndex(atMs: number): number {
  const d = (atMs - J2000_MS) / MS_PER_DAY;
  const sunAnomaly = RAD * (357.5291 + 0.98560028 * d);
  const sunLon =
    sunAnomaly +
    RAD * (1.9148 * Math.sin(sunAnomaly) + 0.02 * Math.sin(2 * sunAnomaly) + 282.9372);
  const moonAnomaly = RAD * (134.963 + 13.064993 * d);
  const moonLon = RAD * (218.316 + 13.176396 * d + 6.289 * Math.sin(moonAnomaly));
  return Math.cos(2 * (moonLon - sunLon));
}
