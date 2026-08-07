# Capri Sea Guide

An hourly, 7-day marine **reliability** forecast for Capri: the odds that each
sea activity (Blue Grotto entry, island boat tours, the Amalfi/Naples ferries,
kayak, swims) gets **closed or cancelled** by sea conditions, plus the live
open/closed status of the Blue Grotto.

Built with Next.js (App Router), TypeScript and Tailwind v4. The forecast model
was ported from a design prototype and extended with a multi-model + ensemble
confidence engine.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine unit tests (vitest)
npm run build    # production build
npm run lint
```

No environment variables or API keys are required; all upstream sources are
public.

## How it works

```
 Open-Meteo marine (4 wave models) ┐
 Open-Meteo forecast (6 NWP models)├─▶ /api/forecast ─▶ engine ─▶ numeric report ─▶ client renders
 Open-Meteo ensemble (51 members)  ┘        (cached hourly)         (view layer → copy)

 capri.net + bluegrotto.tours ─────▶ /api/grotto ─▶ cross-checked live status
                                            (cached 30 min)

 Open-Meteo (past 7d + today/tomorrow) ┐
 recorded calls (Upstash, optional)    ├▶ /api/grotto-history ─▶ today's bar + 7-day history
                                       ┘         (cached 5 min)
```

Everything that touches the network runs **server-side** in route handlers, so
the browser never depends on public CORS proxies (the original prototype did).
Responses are cached (`revalidate`) to match the page's refresh cadence.

The client fetches `/api/forecast` and `/api/grotto` (plus `/api/grotto-history`
for the grotto card), then re-derives all display text at render time from a live
clock, so "3 min ago", the current hour, and the verdict wording stay current
without re-fetching. It also refreshes hourly and when a backgrounded tab is
refocused after going stale.

### Confidence from more sources

The prototype judged forecast confidence from just ECMWF vs GFS. This build
widens that:

- **Wind / gusts / pressure**: six deterministic models (ECMWF, GFS, ICON,
  GEM, Météo-France, UKMO) **plus ECMWF's 51-member ensemble**.
- **Waves**: four wave models (ECMWF WAM, GWAM, Météo-France, NCEP WaveWatch).

Per hour we take the multi-model consensus as the central estimate and measure
**disagreement** (cross-model std, ensemble std, wave-model std). That
disagreement, not a two-model difference, drives the confidence line. See
`SPREAD` and `CONFIDENCE` in [`src/config/tuning.ts`](src/config/tuning.ts).

### The Blue Grotto card

The grotto folds three things into one card:

- **Live status** — open / closed / outside-hours, cross-checked across
  capri.net and bluegrotto.tours (they can disagree; the card says so).
- **Today's timeline** — a bar for the current opening day. The part of the day
  that has already happened is drawn solid from the recorded calls ("reported as
  of HH:MM"); the rest of the day is a pale forecast (**expected open** or
  **possible closure**). When the grotto closes for the day, the bar rolls over
  to *tomorrow's* forecast and today drops into the history below.
- **Last 7 days** — a drop-down of past days. A day the recorder logged shows
  solid open/closed with the sea at each change; a day it didn't shows **"No
  data"**, with the sea still listed morning and afternoon.

The forecast bar bands its hours with the same cutoff as the activity pills
(`GROTTO_FORECAST` reuses the `PILL_BANDS` "low" boundary), so the pale bar and
the pills can never tell different stories. Without the recorder (below), today
is all forecast and every past day reads "No data".

### A fix worth knowing about

The prototype's direction function (`cosFace`) was **inverted**: it made SE
swell close the NW-facing Blue Grotto and treated N/NW swell as harmless, the
opposite of its own copy and of Open-Meteo's documented "coming from" direction
convention. This build corrects it (NW swell closes the grotto). The original
behavior is preserved behind `DIRECTION.legacyInverted` in
[`src/config/tuning.ts`](src/config/tuning.ts) for exact reproduction.

## Changing the copy or the thresholds

All wording and all tuning live in [`src/config/`](src/config): the engine
hard-codes nothing:

| File | What lives there |
| --- | --- |
| [`copy.ts`](src/config/copy.ts) | **Every user-facing string**, including the conditional summaries (verdict labels, "sailor" lines, confidence lines, the "why" line, grotto status lines) and the methodology text. The thresholds that pick *which sentence* shows sit next to the strings. |
| [`tuning.ts`](src/config/tuning.ts) | Numeric model tuning: sources, verdict/pill bands, confidence weights, grotto physics, spread blend, refresh cadence. |
| [`activities.ts`](src/config/activities.ts) | The activities and their closure thresholds (wave/wind midpoints, exposure bearing). |

Want to reword the "boatmen often refuse" line, or move the Calm/Good cutoff?
Edit one file; logic is untouched.

## Project structure

```
src/
  app/
    api/forecast/route.ts        # aggregates all sources → numeric report (cached 1h)
    api/grotto/route.ts          # cross-checked live grotto status (cached 30m)
    api/grotto-history/route.ts  # today's bar + 7-day history (cached 15m)
    api/poll-grotto/route.ts     # recorder: logs one live reading (optional)
    page.tsx, layout.tsx, globals.css   # design tokens live in globals.css
  config/                   # ← all copy + tuning (the "change me" layer)
  lib/
    forecast/               # pure engine: math, model, aggregate, view, types
    sources/                # Open-Meteo + grotto readers (the only network code)
    store/                  # Upstash reading log (inert without env vars)
    tones.ts                # semantic tone → design-system class map
  components/
    ui/                     # Card, Chip, Button, Collapsible, Skeleton
    forecast/               # NowCard, GrottoStatus, TodayCards, SevenDay, Methodology
  hooks/                    # use-forecast, use-grotto, use-grotto-history, use-now
```

The engine (`src/lib/forecast`) is pure and framework-free. Unit tests cover the
math and the direction-physics fix
([`engine.test.ts`](src/lib/forecast/engine.test.ts)), the grotto timeline
segments and view models
([`grotto-actual.test.ts`](src/lib/forecast/grotto-actual.test.ts),
[`grotto-view.test.ts`](src/lib/forecast/grotto-view.test.ts)), and the live
status parsers ([`sources.test.ts`](src/lib/sources/sources.test.ts)).

## Deployment

Needs a Node/serverless host (the route handlers do the fetching and caching),
e.g. Vercel. `npm run build` && `npm start`, or deploy the repo directly.

## Blue Grotto history recorder (optional)

Out of the box the card needs no storage: today's bar is all forecast, and each
of the last 7 days reads **"No data"** for open/closed (the sea for those days is
still shown, morning and afternoon, reconstructed from Open-Meteo). Turn on the
recorder to also capture the boatmen's *actual* daily calls, open/closed with the
times they changed, which then fill in as the solid bars. It is forward-only:
history builds up from the day you switch it on.

1. **Store.** In Vercel: Storage, Create Database, Upstash Redis. Vercel injects
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without them the recorder is inert
   and the app runs exactly as before. A plain Upstash setup also works via
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
2. **Secret.** Set `POLL_SECRET` (any random string) as a Vercel env var. Once the
   store is configured on a deployment this secret is **required**: the poll
   endpoint fails closed (returns 500) if it is missing, so a dropped or mistyped
   secret can never leave the endpoint open. Local dev is exempt, so it still runs
   without one.
3. **Scheduler.** An [Upstash QStash](https://upstash.com/docs/qstash) schedule,
   pointed at `https://<domain>/api/poll-grotto`:

   | Field | Value |
   | --- | --- |
   | Cron | `7,37 9-17 * * *` |
   | Timezone | `Europe/Paris` — see below |
   | Method | `POST` |
   | Header | `Upstash-Forward-Authorization` → `Bearer <POLL_SECRET>` |

   That is a reading every 30 min through the open day, 18 messages daily against
   a 1,000/day free tier. QStash strips the `Upstash-Forward-` prefix, so the
   endpoint receives a plain `Authorization` header. Off-peak minutes are habit,
   not superstition: this ran on a GitHub Actions cron first, which dropped
   roughly 26 of 29 due runs and delivered the rest 5 to 94 minutes late.

   The timezone is Capri's, but the console's list has no `Europe/Rome`.
   `Europe/Paris` is exact — same CET/CEST offsets and the same EU switchover
   dates, verified across a full year. Berlin, Madrid and Malta are equally
   valid; Athens is an hour out and would poll before the cave opens. The API
   accepts a literal `CRON_TZ=Europe/Rome` if you prefer it spelled honestly.

   Point it at the domain the site actually *serves* on, not one that redirects:
   a redirect is not an HTTP error, so it would report success while recording
   nothing, and `Authorization` is dropped on a cross-host hop anyway (apex and
   `www` count as different hosts).

   The endpoint self-gates to opening hours and stores only `{ time, status }`;
   sea conditions are reconstructed from Open-Meteo. Readings are kept
   indefinitely; the card shows the most recent 7 (`HISTORY_DAYS`).

   To record one by hand — the whole job is a single request:

   ```bash
   curl -s -X POST https://<domain>/api/poll-grotto -H "Authorization: Bearer $POLL_SECRET"
   ```

## Data & disclaimer

Forecast data © [Open-Meteo](https://open-meteo.com) (CC-BY 4.0). Live grotto
status is read from capri.net and bluegrotto.tours. Guidance only, not a
navigational forecast; the boatmen and the port authority have the final word.
