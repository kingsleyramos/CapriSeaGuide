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
npm run backtest # score the grotto model against the recorder (see below)
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

 boatmen's feed + capri.net ────────▶ /api/grotto ─▶ cross-checked live status
                                            (cached 10 min)

 Open-Meteo (past 7d + today/tomorrow) ┐
 recorded calls (Upstash, optional)    ├▶ /api/grotto-history ─▶ today's bar + 7-day history
                                       ┘         (cached 5 min)
```

Everything that touches the network runs **server-side** in route handlers, so
the browser never depends on public CORS proxies (the original prototype did).

Every route is dynamic and bounds its own staleness with a `Cache-Control`
header, deliberately rather than by `export const revalidate`: that puts a route
in Next's ISR cache, whose expiry is a year, so on a quiet site the first visitor
of the day is served whatever was last generated — 23 hours old, in one observed
case — and only *then* triggers the regeneration that the *next* visitor gets.

Freshness is the sum of three layers, and the slowest one sets the floor: how
often the recorder writes (10 min), how long the CDN holds a response, and how
often the client asks. There is no point tightening one past another.

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

- **Live status** — open / closed / outside-hours, cross-checked across the
  boatmen's own feed and capri.net (they can disagree; the card says so).
- **Today's timeline** — a bar for the current opening day. The part of the day
  that has already happened is drawn solid from the recorded calls ("reported as
  of HH:MM"); the rest of the day is a pale forecast (**expected open** or
  **likely closed**) that starts from the last recorded call and relaxes
  toward the model as it ages (see `GROTTO_PERSISTENCE`). When the grotto closes
  for the day, the bar rolls over to *tomorrow's* forecast and today drops into
  the history below.
- **Last 7 days** — a drop-down of past days. A day the recorder logged shows
  solid open/closed with the sea at each change; a day it didn't shows **"No
  data"**, with the sea still listed morning and afternoon.

The forecast bar bands its hours with the same cutoff as the activity pills
(`GROTTO_FORECAST` reuses the `PILL_BANDS` "low" boundary). With no reading to
go on the two therefore say the same thing; once the recorder has seen a closure
the bar knowingly departs from the pill, because they answer different
questions — the pill is "would the sea close the cave this afternoon", the bar
is "will it be open when you get there". Without the recorder (below), today is
all forecast and every past day reads "No data".

### How the grotto model is checked against the boatmen

The recorder logs what the boatmen actually did; Open-Meteo keeps what every
model run said up to a week beforehand. The model is a pure function of those
fields, so the forecast the page *would have shown* N days ahead can be rebuilt
exactly and scored against the log:

```bash
npm run backtest   # needs the store credentials and the network; ~10 s
```

Over the first 85 recorded days (7 Aug – 30 Oct 2026, 44 mostly shut), where the
better constant, always answering "shut", is right 52% of the time:

| Forecast made | Days called right | Prototype physics | Closures caught | False alarms |
| --- | --- | --- | --- | --- |
| Same day | 86% | 69% | 36 / 44 | 4 / 41 |
| 1 day ahead | 88% | 64% | 36 / 44 | 2 / 41 |
| 2 days ahead | 88% | 68% | 36 / 44 | 2 / 41 |
| 3 days ahead | 88% | 64% | 35 / 44 | 1 / 41 |
| 4 days ahead | 84% | 64% | 32 / 44 | 2 / 41 |
| 5 days ahead | 80% | 61% | 31 / 44 | 4 / 41 |
| 6 days ahead | 76% | 62% | 31 / 44 | 7 / 41 |

On the 19 days when the status differed from the day before, which "same as
yesterday" gets wrong by definition, it is right on 14–17 depending on lead. The
warning band is the part to trust: one day ahead, hours at 30% or above were
closed 93% of the time. Below 30% is weaker, with 76% open, and the 15–30% stretch
just above the floor was closed 58% of the time: the figures run low.

What moved it, each in [`tuning.ts`](src/config/tuning.ts):

- **Northerly wind** (`GROTTO.northWind`). A steady wind from the north shuts the
  cave in a sea the wave models call flat. This was most of the gain: over 2.5 kn
  the cave was mostly shut on 19 of 20 days.
- **Swell reaching round** (`GROTTO.swell.reach`). Swell from the west and
  south-west closes the cave nearly as well as swell from the north-west; wind
  chop of the same height from that side does not.
- **An honest floor** (`GROTTO.floor`). When nothing fires, the cave is still shut
  about one hour in seven, so the figure bottoms out at 15%, not 4%.
- **Spring tides** (`GROTTO.springTide`, below): a small lean, not a verdict.

On the day itself the recorder outranks all of it: a closure is still standing six
hours later nearly 90% of the time, so the pale bar starts from the last recorded
call and relaxes toward the model (`GROTTO_PERSISTENCE`).

**The tests that count.** Wind, swell and floor were frozen on 6 Oct. On the 24
days after that (18 shut, so always "shut" scores 75%), one day ahead they were
right on 22, three days ahead on 23; the prototype physics managed 15 and 16. That
is two storm episodes and a calm spell, so it is encouraging rather than settled.
Separately, 18 days from 2025–26 recovered from Wayback Machine snapshots of
capri.net, never used for tuning, give 15 of 18 right. The prototype physics also
scores 15 of 18 there and only loses on Brier (0.178 against 0.130), so that sample
supports the model without proving it better. Days from `FROZEN_FROM` on print
separately in the backtest: that table is the one to believe.

**Tide and moon.** The boatmen blame high tide, and bluegrotto.tours names spring
tides as decisive. The record looks like it agrees: in the three days from each of
six new and full moons the cave was mostly shut on 17 of 18 days, against 27 of 67
otherwise, and on none of the 10 days at neaps. That pattern is mostly luck. Fifteen
of those 18 days were stormy anyway, and storms do not follow the moon: over four
years they are about as common in that window as outside it (64% against 60%), and
this record's 82% against 51% comes up in only 3% of stretches this long.

What survives once the weather is held fixed is smaller but real. On otherwise calm
days, across both samples, the cave shut on 3 of 7 days in the window against 7 of
49 outside it. On calm days water above the day's mean at 09:00 went with being shut
at 09:00 on 9 of 20 days, against 4 of 28 below it. Reopenings land on falling water
9 times in 11. Hourly water level as a model input adds nothing, though, so this
looks like the morning call rather than clearance under the arch hour by hour. Hence
a lean sized to stop a calm day just under the warning line, at about 29%. Half as
big again (weight 0.6) it scored 12 of 18 on the independent sample. The size is the
one constant here chosen with the October days in view.

**Rules for the next change**, learned the slow way:

- Closures come in runs of days, so leaving out single days tests nothing. Judge a
  change on whole blocks of weeks, on each half of the record separately, and on
  archived forecasts rather than hindsight.
- Give any periodic predictor a placebo, sliding it against the outcomes by days it
  is not periodic in, and check that test *can* reject. Sliding by a full cycle
  restores the real alignment, so counting those shifts leaves a floor on p: that
  is how the moon got wrongly dismissed at p ≈ 0.36 on 62 days. Shuffling the order
  of the open and shut runs has no such floor.
- Check a new term against a plain constant offset.
- Ask whether the predictor is standing in for something else, and look outside the
  record for the answer. Four years of weather took a minute to fetch and changed
  the conclusion about the moon.
- Validate the stack, not the parts. A term that helps the old model can hurt the new
  one, and a formula should be checked at its extremes.

**Tried and left out**, so nobody spends the week again:

| Idea | Result |
| --- | --- |
| Carrying yesterday's closure overnight | Helped the old model as a stand-in for the wind it could not see. On this one a weight of 0.1 moves one day's call and 0.2 takes false alarms from 2 to 13. |
| Re-tuning swell sensitivity and the off-axis floor | Held out, 52 of 61 days right fell to 44, false alarms 2 to 12. |
| Multiplying the odds to fix the low figures | Better Brier in every month, but the best multiplier differs by month (2.5 in August, 6 in September), and false alarms climb with it unless the warning line moves too. |
| A direction-free "too rough for small boats" term | Helps one day (21 Oct, 1.2 m from the SE), and only on the same-day forecast, where the recorder already outranks the model. Its swell from behind the island is the record's only real case. |
| A higher-resolution or nearer wave model (EWAM 5 km, ECMWF 0.1°), or a nearer sample point | No better than the four-model consensus, which is the best single input (day-level AUC 0.81 against 0.74–0.80). Three of the four do sample south of the island; at these scales it does not matter. |
| Peak period in the surge term | `longPeriodSurge` never fires here in summer: it gates on mean period ≥ 8 s and the window tops out at 6.5 s. Fed real peak period it adds nothing once the wind term exists. Left as is for winter swell. |
| Rain, thunderstorms, CAPE, cloud, visibility, pressure, weekday | No signal on calm-sea days, which is where another predictor was needed. |
| Rough sea in the previous 24–72 h | Excellent in September, absent in August. Did not replicate across halves. |
| Letting the afternoon inherit the morning's risk | Slightly better Brier, three times the false alarms. |
| Leaning harder toward "closed" | Days called right is flat up to a 15% base and falls after it: at 25%, nine false alarms instead of one. |
| Moving the 30% warning line | 25% scores better on this record (92% against 88% one day ahead) mainly by flagging calm spring-tide days, the trade the independent sample argues against. Worth revisiting with more calm days. |

**What is still unexplained.** Calm, windless, away from a new or full moon, and shut
anyway: 16 Sep and 19 Sep among others. Nothing in any feed here separates those from
the days around them. The floor is the honest statement of that, not a fix for it.

**Winter is untested.** Everything above is August to October. From November to
February capri.net replaces its banner with static text saying the cave is "generally
closed", so it reads `unknown` then. The boatmen's own feed is the primary source so
that recording carries on through winter, if they keep updating it. The card carries
a standing note from November to March until those months have been checked. Expect
the floor and the spring-tide lean to need revisiting once they are in.

**Opening hours.** The Ministry of Culture lists April–October 09:00–18:00;
capri.net lists 09:00–16:00 for April–May and 09:00–15:00 for October.
`GROTTO_HOURS` follows the ministry. The flag does not settle it: on all ten October
days it was open at 15:00 it stayed open to the last poll. No day's label changes if
October is trimmed to 15:00.

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
   | Cron | `*/10 9-17 * * *` |
   | Timezone | `Europe/Paris` — see below |
   | Method | `POST` |
   | Header | `Upstash-Forward-Authorization` → `Bearer <POLL_SECRET>` |

   A reading every 10 min through the open day: 54 messages daily against a
   1,000/day free tier, and ~1.4 MB of store per year. QStash strips the
   `Upstash-Forward-` prefix, so the endpoint receives a plain `Authorization`
   header.

   The cadence is set by how precisely you want *transitions* placed, not by how
   much data you want. Same-status readings collapse into one segment, so a
   quiet day looks identical at any cadence; what changes is the error on the
   one moment that matters. A closure at 11:05 is drawn at 11:10 here, and would
   have been drawn at 11:30 on a half-hourly poll. The cost is three times the
   traffic to two websites that are not ours, which is the real ceiling — not
   the free tier.

   Recreate the schedule from scratch with:

   ```bash
   curl -X POST "https://qstash.upstash.io/v2/schedules/https://<domain>/api/poll-grotto" \
     -H "Authorization: Bearer $QSTASH_TOKEN" \
     -H "Upstash-Cron: CRON_TZ=Europe/Rome */10 9-17 * * *" \
     -H "Upstash-Method: POST" \
     -H "Upstash-Forward-Authorization: Bearer $POLL_SECRET"
   ```

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
status is read from the Motoscafisti di Capri feed and capri.net. Guidance only, not a
navigational forecast; the boatmen and the port authority have the final word.
