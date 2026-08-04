# Capri Sea Tours: Reliability Forecast

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
```

Everything that touches the network runs **server-side** in route handlers, so
the browser never depends on public CORS proxies (the original prototype did).
Responses are cached (`revalidate`) to match the page's refresh cadence.

The client fetches `/api/forecast` and `/api/grotto`, then re-derives all display
text at render time from a live clock, so "3 min ago", the current hour, and
the verdict wording stay current without re-fetching. It also refreshes hourly
and when a backgrounded tab is refocused after going stale.

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
    api/forecast/route.ts   # aggregates all sources → numeric report (cached 1h)
    api/grotto/route.ts     # cross-checked live grotto status (cached 30m)
    page.tsx, layout.tsx, globals.css   # design tokens live in globals.css
  config/                   # ← all copy + tuning (the "change me" layer)
  lib/
    forecast/               # pure engine: math, model, aggregate, view, types
    sources/                # Open-Meteo + grotto readers (the only network code)
    tones.ts                # semantic tone → design-system class map
  components/
    ui/                     # Card, Chip, Button, Collapsible, Skeleton
    forecast/               # NowCard, GrottoBar, TodayCards, SevenDay, Methodology
  hooks/                    # use-forecast, use-grotto, use-now
```

The engine (`src/lib/forecast`) is pure and framework-free, covered by
[`engine.test.ts`](src/lib/forecast/engine.test.ts) (math, the direction-physics
fix, aggregation, and the view models).

## Deployment

Needs a Node/serverless host (the route handlers do the fetching and caching),
e.g. Vercel. `npm run build` && `npm start`, or deploy the repo directly.

## Blue Grotto history recorder (optional)

The "last 7 days" history renders a model hindcast out of the box, with no
storage. To also record the boatmen's *actual* daily calls (open/closed, plus
intra-day changes with times), enable the recorder. It is forward-only: history
accrues from the day you switch it on.

1. **Store.** In Vercel: Storage, Create Database, Upstash Redis. Vercel injects
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Nothing else to configure, and
   without them the recorder is inert (the app runs exactly as before).
2. **Secret.** Set `POLL_SECRET` (any random string) as a Vercel env var, and
   add the same value plus `POLL_URL` (`https://<domain>/api/poll-grotto`) as
   GitHub repository secrets.
3. **Scheduler.** [`.github/workflows/poll-grotto.yml`](.github/workflows/poll-grotto.yml)
   polls every 30 min during opening hours. The endpoint self-gates to opening
   hours and stores only `{ time, status }`; sea conditions are reconstructed
   from Open-Meteo. Retention is 30 days (`RETENTION_DAYS`).

## Data & disclaimer

Forecast data © [Open-Meteo](https://open-meteo.com) (CC-BY 4.0). Live grotto
status is read from capri.net and bluegrotto.tours. Guidance only, not a
navigational forecast; the boatmen and the port authority have the final word.
