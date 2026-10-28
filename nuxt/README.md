# Susi Air — Pilot App (Nuxt 3)

Frontend for the Susi Air Fullstack Developer Technical Test. Mobile-first pilot app:
sign in, "Hours to Limit" (4 cards + rolling-sum chart), document expiry list, and a
monthly duty calendar. Everything is fetched from the NestJS API — **no mock data ships
in this app**.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Nuxt 3 (Composition API, `<script setup lang="ts">`), SSR on |
| State | Pinia (`@pinia/nuxt`) — auth + all API data |
| Styling | SCSS only (`assets/scss/_variables.scss` holds the design tokens) |
| Chart | Hand-rolled SVG (`components/HoursChart.vue`) — no chart dependency |
| Icons | Inline line-icon SVGs in `BottomNav.vue` — no icon dependency |
| Font | Plus Jakarta Sans (Google Fonts, loaded in `nuxt.config.ts`) |

## Setup

```bash
# 1. backend (separate folder, port 3010 — port 3000 is used by another service)
cd ../nest && npm install && npm run build
PORT=3010 node dist/main.js

# 2. frontend
cd ../nuxt && npm install
npm run dev            # http://localhost:3000
```

Production build / preview:

```bash
npm run build
node .output/server/index.mjs        # honors PORT + NUXT_PUBLIC_API_BASE
```

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_API_BASE` | `http://localhost:3010` | API base URL (runtime config, public) |
| `PORT` | `3000` | Port for `nuxt dev` / the built server |

Local `.env` example:

```
NUXT_PUBLIC_API_BASE=http://localhost:3010
```

Demo credentials: **johndoe / susiairtest**.

## Structure

```
nuxt/
├── app.vue                     # NuxtLayout + NuxtPage shell
├── nuxt.config.ts              # runtimeConfig.apiBase, Pinia, fonts, SCSS entry
├── assets/scss/
│   ├── _variables.scss         # design tokens (§ color palette from the brief)
│   └── main.scss               # global styles + shared .card/.btn/.field primitives
├── composables/useApi.ts       # single API entry point: base URL, bearer token, error envelope
├── middleware/auth.global.ts   # guard: anonymous → /login, authed on /login → /
├── layouts/
│   ├── default.vue             # header + slot + toasts + bottom nav (fetches the pilot)
│   └── auth.vue                # centered card used by /login
├── stores/
│   ├── auth.ts                 # JWT in a cookie, login(), signOut()
│   ├── pilot.ts                # GET /pilot/me
│   ├── flightHours.ts          # cards + summary/chart, range toggle
│   ├── documents.ts            # GET /documents
│   ├── schedule.ts             # GET /schedules per month
│   └── toast.ts                # API-error surface (banner)
├── pages/
│   ├── login.vue               # sign-in form, API error shown inline
│   ├── index.vue               # home
│   └── schedule.vue            # calendar + legend + detail placeholder
├── components/                 # AppHeader, LimitCard, HoursChart, DocumentList,
│                               # DutyCalendar, BottomNav, ToastBanner
├── types/api.ts                # response types mirroring docs/api-contract.md
└── scripts/e2e-check.mjs       # live end-to-end check against a running API + dev server
```

## How the brief maps to the code

- **Hours to Limit cards** — Daily = `GET /flight-hours?from=<today>&to=<today>` (the
  `today` value returned by the API, never `new Date()`). Weekly/Monthly/Annual read the
  `date === today` point from `GET /flight-hours/summary?range=1w|1m|1y`. Limits
  (8/40/100/1050) are fixed by the brief; current values always come from the API.
- **Chart** — only `GET /flight-hours/summary`. 15 points with today centered, grey grid,
  red dashed line at `limit`, Y max = `yMax`, accent `#22C5E8`. Y values are clamped to
  `yMax` at draw time so points above the limit (e.g. 44.7 > 40) still render.
- **Documents** — badge colour/text is driven purely by the API `status`
  (`safe`/`soon`/`expired`); nothing is recomputed client-side.
- **Schedule** — every Prev/Next click calls `GET /schedules?year&month` (no month cache).
  Day cell fill = `base_color`; badge = tick when `count_logbooks === count_schedules`,
  otherwise the remaining count (`count_schedules - count_logbooks`); legend below the
  grid; tapping a day reveals the "Detail page coming soon" placeholder.
- **Bottom nav** — Home and Schedule are wired; Logbook and More are deliberately inert
  placeholders (per brief).
- **Errors** — `useApi()` normalises the backend error envelope
  (`{ statusCode, message, error, ... }`) and pushes it to the toast store, which renders
  a dismissible banner. A 401 also signs the user out.

## Verifying it works

With the backend on `:3010` and `npm run dev` on `:3020`:

```bash
node scripts/e2e-check.mjs
# optional overrides: UI_BASE=http://localhost:3020 API_BASE=http://localhost:3010
```

The script hits the real API, exercises every endpoint the app uses, and asserts on the
**server-rendered HTML** of `/`, `/schedule` and `/login` (pilot name, `1,444.5` total
hours, all four cards and their limits, the chart + red limit line, document badges, the
calendar, the legend, and both route-guard redirects).

## Decisions & trade-offs

- **JWT in a cookie, not localStorage** — so the global route middleware can read it
  during SSR instead of bouncing every deep link to `/login`.
- **Data prefetched by awaiting store actions in setup** (the layout fetches the pilot,
  pages fetch their own data). `onMounted` alone would leave the first paint empty under
  SSR, and awaiting inside a `useAsyncData` callback detaches the Nuxt instance from the
  Pinia stores.
- **No chart/icon library** — a ~40-line SVG component and a handful of inline icons keep
  the dependency surface at Nuxt + Pinia.
- **`today` is always the API's `today`** (`2026-05-15` in the dataset) — used for the
  daily card range, the chart's centre marker, the calendar marker, and "as of" labels.
- With more time: real Logbook/More screens, duty-day detail page, unit tests around the
  stores, and a Playwright pass over the range toggle and month navigation.
