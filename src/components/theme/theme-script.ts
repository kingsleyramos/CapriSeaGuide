import { LOCATION } from "@/config/tuning";

const { lat, lon } = LOCATION.island;

/**
 * Decides the theme and applies it, as the first thing the document does.
 *
 * This runs inline in the head, before any paint, because the alternative --
 * deciding in React -- renders the light page first and repaints it dark. It is
 * a hand-inlined copy of `isDaylight` from lib/sun: an inline script cannot
 * import, and the CSP grants no 'unsafe-eval' for it to compile one. A test
 * (lib/sun.test.ts) evaluates this string against the module every hour of a
 * year, so the copies cannot drift apart silently.
 *
 * Reads `nowMs` when the test supplies one; in the document there is no such
 * binding and it falls through to the real clock.
 */
export const THEME_SCRIPT = `
var n=typeof nowMs==="number"?nowMs:Date.now(),
R=Math.PI/180,D=864e5,la=${lat},lo=${lon},
j=Math.floor(n/D)+.5,
d=Math.round(j+2440587.5-2451545+8e-4),
mn=d-lo/360,
M=(357.5291+.98560028*mn)%360,
C=1.9148*Math.sin(M*R)+.02*Math.sin(2*M*R)+3e-4*Math.sin(3*M*R),
L=(M+C+180+102.9372)%360,
T=2451545+mn+53e-4*Math.sin(M*R)-69e-4*Math.sin(2*L*R),
dc=Math.asin(Math.sin(L*R)*Math.sin(23.44*R)),
ca=(Math.sin(-.833*R)-Math.sin(la*R)*Math.sin(dc))/(Math.cos(la*R)*Math.cos(dc)),
w=Math.acos(Math.min(1,Math.max(-1,ca)))/R/360,
ms=function(x){return(x-2440587.5)*D},
sr=ms(T-w),ss=ms(T+w),
t=n>=sr&&n<ss?"light":"dark";
document.documentElement.dataset.theme=t
`
  .trim()
  .replace(/\n/g, "");
