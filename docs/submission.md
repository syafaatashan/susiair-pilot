# Susi Air — Fullstack Developer Technical Test

**Candidate:** Muh. Syafa'at Ashan · kiflyr@gmail.com
**Brief:** Full Stack Technical Brief v3 · Susi Air Pilot App · Nuxt 3 + NestJS
**Date:** 28 October 2026

---

## 1. Deliverables

| Item | Link |
| --- | --- |
| GitHub repository | <https://github.com/syafaatashan/susiair-pilot> |
| Live web app (Nuxt 3) | `<<WEB_APP_URL>>` (deployed by candidate on Vercel — see §6 / `docs/deployment.md`) |
| Live API (NestJS) | `<<API_URL>>` (deployed by candidate on Render — see `docs/deployment.md`) |

Repository layout: `nest/` (REST API) and `nuxt/` (pilot web app), plus `docs/` with the
API contract, deployment guide and audit reports.

Demo credentials: **`johndoe` / `susiairtest`**

---

## 2. What was built

### Backend — NestJS

Six endpoints, exactly as specified:

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | `{ username, password }` → JWT. One hardcoded pilot account. |
| `GET` | `/pilot/me` | Name, total flight hours, avatar URL. |
| `GET` | `/flight-hours?from=&to=` | Daily flight hours; every calendar day in range is returned. |
| `GET` | `/flight-hours/summary?range=` | Rolling-sum series for `1w\|1m\|3m\|6m\|1y`. |
| `GET` | `/documents` | Documents with expiry dates and urgency status. |
| `GET` | `/schedules?year=&month=` | One month of schedule entries plus the duty legend. |

Requirements from the brief, and where they live:

- **Module / controller / service / DTO separation** — one module per resource, shared
  cross-cutting code in `src/common/`.
- **Input validation** on every parameterised endpoint. A custom `@IsCalendarDate`
  validation rejects impossible dates such as `2026-02-30`; `from > to` is rejected; the
  flight-hours range is capped at 366 days so a single request cannot return an unbounded
  payload.
- **Global exception filter** returning one shape for every failure:
  `{ statusCode, message, error, timestamp, path }`. Internal errors are logged, never
  leaked.
- **Auth guard on every endpoint except `/auth/login`** — a `JwtAuthGuard` verifying the
  token issued at login. Missing, malformed and expired tokens all return 401.
- **Rolling sum runs on the server.** It lives in the method `rollingWindowBluffing()` in
  `nest/src/flight-hours/flight-hours.service.ts`, with the required comment
  `// this is a rolling sum calculation :)` directly above it.
- **JSON seeds, no database.** The three provided files are read from `nest/data/` once at
  boot.

### Frontend — Nuxt 3

- **Sign In** — pilot form; bad credentials surface the API's message inline.
- **Home** — header (greeting, name, total flight hours, avatar); the **Hours to Limit**
  section with the four cards (Daily 8 h, Weekly 40 h, Monthly 100 h, Annual 1050 h) and
  the rolling-sum chart with a `1w / 1m / 3m / 6m / 1y` toggle defaulting to `1w`, today
  centred, a red limit line and the range-specific Y maximum; the **My Documents** list with
  green/amber/red urgency badges; and the bottom navigation (Home, Schedule, Logbook, More).
- **Schedule** — monthly calendar with previous/next month buttons, every change fetching
  `/schedules` afresh; day cells filled with the API's `base_color`; a tick when
  `count_logbooks === count_schedules`, otherwise the number of remaining duties; the legend
  below the grid; a "Detail page coming soon" placeholder on tap.
- **Pinia** drives auth and all data; components never fetch on their own.
- **Auth-aware route guard** — anonymous users are sent to `/login`, authenticated users
  away from it.
- **API errors surface in the UI** through a dismissible toast banner.
- **No mock data in the frontend** — every value is fetched from the API, and "today" is the
  API's `today`, never `new Date()`.
- **Styling** — SCSS only, Plus Jakarta Sans, the brief's palette, 12–16 px card radii,
  pill primary buttons, mobile-first.

---

## 3. The rolling sum, and the edge cases the brief calls out

For every day in the display window the API returns the sum of flight hours over the
preceding `windowDays` calendar days, ending on that day.

| Toggle | Sum window | Limit line | Chart Y max |
| --- | --- | --- | --- |
| `1w` | last 7 days | 40 h | 45 h |
| `1m` | last 30 days | 100 h | 125 h |
| `3m` | last 90 days | 300 h | 325 h |
| `6m` | last 180 days | 600 h | 625 h |
| `1y` | last 365 days | 1050 h | 1200 h |

- **Zero-hour days** contribute 0, and missing dates are never skipped: the calculation
  walks the calendar rather than iterating only over rows that exist.
- **Windows that start before the dataset** (the data begins 2024-12-27) sum only the days
  that exist. Earlier days contribute 0 — deliberate, because shrinking the divisor instead
  would make the first weeks of data look artificially safe.
- **Future dates** still return a value: the same window ending on that date.
- **Values above the red limit line** are returned as-is — the `1w` series peaks at 44.7 h
  against a 40 h limit — and the chart clamps only the drawing, never the data.

---

## 4. Design choices worth flagging

**One "today", configurable.** The brief says to treat today as 15 May 2026 and not to use
`new Date()`. The schedules dataset agrees (`2026-05-15`), but the documents dataset ships
its own `today` of `2026-05-31`, which would put the two halves of the UI on different
dates and make a deployed instance disagree with a local one. There is therefore a single
`APP_TODAY` constant (default `2026-05-15`, the brief's date) used by every endpoint; set
`APP_TODAY=2026-05-31` to reproduce the documents dataset's own reading. This is documented
in the README and the API contract.

**UTC date arithmetic.** `daysRemaining` and the rolling window use `Date.UTC` and
`Math.round`. A local-time implementation gains an hour when a window crosses a DST
boundary, which shifts a document badge by a day depending on where the API is hosted. There
is a regression test for this.

**The JWT is stored in a cookie**, not `localStorage`, so the global route middleware can
evaluate auth during SSR instead of bouncing every deep link to `/login`.

**No chart or icon dependency.** The chart is a small SVG component and the icons are inline
paths, keeping the dependency surface at Nuxt + Pinia.

---

## 5. Verification

- **Backend:** `npm test` — 12 unit tests covering the rolling sum against an independent
  reference implementation, the document urgency rules, month filtering and the edge cases
  above. `npm run test:e2e` — 21 HTTP tests covering auth, guard behaviour, validation and
  the error envelope. Both suites also pass with `TZ=America/New_York`.
- **Frontend:** `npm run typecheck` and `npm run build` are clean.
- **End to end:** `nuxt/scripts/e2e-check.mjs` drives the running API and asserts on the
  server-rendered HTML of `/`, `/schedule` and `/login` — 16/16 checks.
- **Independent audit:** the code was reviewed against the brief by a separate auditor; the
  findings and their resolutions are in `docs/audit/`.

---

## 6. What I would improve with more time

- Real Logbook and More screens, plus the duty-day detail page the schedule placeholder
  hints at.
- Component and store tests (Vitest + `@nuxt/test-utils`) and a Playwright pass over the
  range toggle, month navigation and mobile layout.
- Replace the hardcoded pilot with a real user store, and swap the JSON seeds for a database
  behind the same service interface — the services are already the only place that touches
  data.
- Short-lived access tokens with refresh, and an `httpOnly` cookie so JavaScript cannot read
  the token.
- A proper design-system pass (spacing scale, shared component variants) instead of ad-hoc
  SCSS, plus chart tooltips.
- Rate limiting and request-size limits at the edge.

---

## 7. How to run it locally

```bash
# API
cd nest && npm install && npm run build
PORT=3010 node dist/main.js          # PowerShell: $env:PORT="3010"; node dist/main.js

# Web app (Nuxt, SSR) — port 3020 (3000 is taken by 9router/Docker)
cd nuxt && npm run build
NUXT_API_BASE=http://localhost:3010 PORT=3020 node .output/server/index.mjs
#   or dev:  NUXT_API_BASE=http://localhost:3010 npm run dev -- --port 3020
```

Demo credentials: **`johndoe` / `susiairtest`**