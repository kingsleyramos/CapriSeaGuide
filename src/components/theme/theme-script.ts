import { LOCATION } from "@/config/tuning";

const { lat, lon } = LOCATION.island;

/**
 * Applies the theme before the first paint; deciding it in React instead would
 * render the light page and repaint it dark.
 *
 * A hand-inlined copy of `isDaylight`: an inline script cannot import, and the
 * CSP grants no 'unsafe-eval' to compile one. lib/sun.test.ts evaluates this
 * string against the module hourly across a year so they cannot drift.
 *
 * A stored choice beats the sun. localStorage is guarded because it throws
 * outright in some privacy modes. `nowMs` is the test's injection point; in the
 * document no such binding exists and it falls through to the clock.
 */
export const THEME_KEY = "capri-theme";

export const THEME_SCRIPT = `
var o=null;try{o=localStorage.getItem("${THEME_KEY}")}catch(e){}
if(o==="light"||o==="dark"){document.documentElement.dataset.theme=o}else{
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
document.documentElement.dataset.theme=t}
`
  .trim()
  .replace(/\n/g, "");
