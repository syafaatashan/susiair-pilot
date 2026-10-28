# Susi Air — Fullstack Developer Technical Test

A small piece of the **Susi Air Pilot App**: pilots sign in, see how close they are to
their duty limits, check document expiry dates, and browse their monthly duty schedule.

Two apps in one repository:

| Folder | App | Stack |
| --- | --- | --- |
| [`nest/`](./nest) | REST API | NestJS 12 · TypeScript · JWT · JSON seeds (no database) |
| [`nuxt/`](./nuxt) | Pilot web app (mobile-first, SSR) | Nuxt 3 · Composition API · Pinia · SCSS |

- **API contract:** [`docs/api-contract.md`](./docs/api-contract.md)
- **Deployment guide:** [`docs/deployment.md`](./docs/deployment.md)
- **Audit reports:** [`docs/audit/`](./docs/audit)

Demo credentials: **`johndoe` / `susiairtest`**

---

## Quick start

Prerequisites: Node.js 20+ (built and verified on Node 24) and npm.

```bash
# 1. API  →  http://localhost:3010
cd nest
npm install
npm run build
PORT=3010 node dist/main.js
#    (PowerShell: $env:PORT="3010"; node dist/main.js)
#    or hot reload: PORT=3010 npm run start:dev

# 2. Web app  →  http://localhost:3000
cd ../nuxt
npm install
npm run dev
```

The app defaults to `http://localhost:3010` for the API. Point it somewhere else with
`NUXT_API_BASE`. Port 3000 is only a default on the Nuxt side — any free port works
(`npm run dev -- --port 3020`).

### Verify both halves together

```bash
# with the API on :3010 and `npm run dev -- --port 3020` running
cd nuxt && node scripts/e2e-check.mjs
```

That script hits the real API through every endpoint the UI uses and asserts on the
server-rendered HTML of `/`, `/schedule` and `/login`. Latest run: **16/16 checks passed**.

Backend tests:

```bash
cd nest
npm test          # 12 unit tests (rolling sum, documents, schedules, edge cases)
npm run test:e2e  # 21 end-to-end HTTP tests (auth, validation, error shape)
```

---

## What was built

### Backend — `nest/`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | `{ username, password }` → JWT. One hardcoded pilot account. |
| `GET` | `/pilot/me` | Name, total flight hours, avatar URL. |
| `GET` | `/flight-hours?from=&to=` | Daily flight hours for a date range. |
| `GET` | `/flight-hours/summary?range=` | Rolling-sum chart series (`1w\|1m\|3m\|6m\|1y`). |
| `GET` | `/documents` | Pilot documents with expiry dates and urgency. |
| `GET` | `/schedules?year=&month=` | Schedule entries for one month + legend. |

- **Layering:** one module / controller / service / DTO set per resource, plus a shared
  `common/` folder for the auth guard, the global exception filter, the data loader and the
  date helpers.
- **Validation:** every parameterised endpoint validates its input
  (`@IsCalendarDate` rejects impossible dates like `2026-02-30`; `from > to` is a 400; a
  range is capped at 366 days so responses stay bounded). `class-validator` +
  `ValidationPipe` with `transform`/`whitelist`.
- **Auth:** a `JwtAuthGuard` is applied to every endpoint except `POST /auth/login`;
  missing, malformed and expired tokens all return 401.
- **Errors:** a global `GlobalExceptionFilter` returns one shape for every failure —
  `{ statusCode, message, error, timestamp, path }`. Internal errors are logged but never
  leaked to the client.
- **Data:** the three provided JSON files are loaded from `nest/data/` once at boot. No
  database, exactly as the brief allows.

### Frontend — `nuxt/`

- **`/login`** — pilot sign-in form; a rejected login shows the API's message inline.
- **`/`** — header (greeting, name, total hours, avatar), the **Hours to Limit** section
  (four cards: Daily 8 h / Weekly 40 h / Monthly 100 h / Annual 1050 h, each showing the
  current value in its window, the limit, and a bar), the **rolling-sum chart** with a
  `1w · 1m · 3m · 6m · 1y` toggle (default `1w`, today centred, red limit line, Y max from
  the API, `#22C5E8` accent), the **My Documents** list with urgency badges, and the
  bottom navigation (Home, Schedule, Logbook, More).
- **`/schedule`** — monthly calendar with previous/next month buttons (every change is a
  fresh `GET /schedules`), day cells filled with the API's `base_color`, a tick when
  `count_logbooks === count_schedules` and the remaining duty count otherwise, the legend
  below the grid, and a "Detail page coming soon" placeholder on tap.
- **State:** Pinia stores for auth, pilot, flight hours, documents, schedule and toasts;
  no component fetches data on its own.
- **Guard:** `middleware/auth.global.ts` redirects unauthenticated users to `/login` and
  authenticated users away from it.
- **No mock data, no `new Date()` for "today":** every value comes from the API, and the
  `today` supplied by the API drives the daily card, the chart centre and the calendar
  marker.
- **Styling:** SCSS only, design tokens taken from the brief, Plus Jakarta Sans, 12–16 px
  card radii, pill primary buttons, mobile-first.

---

## Environment variables

### Backend (`nest/`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port. Set it (`3010` locally) if 3000 is taken. |
| `JWT_SECRET` | development fallback + loud warning | Signing secret for login tokens. **Set this in any deployment.** |
| `APP_TODAY` | `2026-05-15` | The "today" reference date. See the note below. |

### Frontend (`nuxt/`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NUXT_API_BASE` | `http://localhost:3010` | API base URL (server-side runtime config). |
| `PORT` | `3000` | Port for `nuxt dev` / the built server. |

---

## Design choices worth knowing

**The rolling sum runs on the server.** `GET /flight-hours/summary?range=…` returns the
finished series; the frontend only draws it. The calculation lives in one method,
`rollingWindowBluffing()`, in
[`nest/src/flight-hours/flight-hours.service.ts`](./nest/src/flight-hours/flight-hours.service.ts)
— the name and the comment above it are required verbatim by the brief.

**Edge cases the brief calls out, and how they are handled:**

- *Zero-hour days* contribute `0`; the sum walks the calendar rather than iterating only
  over rows that exist, so no date is ever skipped.
- *Windows that start before the dataset* (the data begins 2024-12-27) sum only the days
  that exist; earlier days contribute `0`. The alternative — returning `null` or shrinking
  the divisor — would make the first weeks look artificially safe, so `0` is deliberate.
- *Future dates* still return a value: the same window ending on that date. Days after the
  last data point contribute `0`.
- *Values above the red limit line* are returned as-is (the 1w series peaks at 44.7 h
  against a 40 h limit) and the chart clamps only the drawing, never the data.

**One "today", configurable.** The brief says to treat today as 15 May 2026 and not to use
`new Date()`. The schedules dataset agrees (`2026-05-15`) but the documents dataset ships
its own `today` of `2026-05-31`. Using each file's own value would make a deployed instance
behave differently from a local one, so there is a single `APP_TODAY` (default
`2026-05-15`, the brief's date) in
[`nest/src/common/config.ts`](./nest/src/common/config.ts). Set `APP_TODAY=2026-05-31` to
reproduce the documents dataset's own reading.

**Dates are computed in UTC.** `daysRemaining` and the rolling window use `Date.UTC` and
`Math.round`, not local-time `Date` maths — a local-time implementation gains an hour across
a DST boundary and can shift a document badge by a day depending on where the API is
deployed. Covered by a regression test.

**The JWT lives in a cookie** (`susi_token`) rather than `localStorage`, so the global route
middleware can evaluate auth during SSR instead of bouncing every deep link to `/login`.

**No chart or icon library.** The chart is a ~40-line SVG component and the icons are inline
SVG paths, keeping the dependency surface at Nuxt + Pinia. The trade-off is no tooltips or
zoom, which the brief does not ask for.

**Logbook and More are intentionally inert.** The brief says all three tabs must appear in
the design but only the tested flows need to work.

---

## Deployment

See [`docs/deployment.md`](./docs/deployment.md) for exact steps. In short:

- **API** → Render (or Railway/Fly) using `nest/render.yaml` or `nest/Dockerfile`.
  Set `JWT_SECRET`; leave `APP_TODAY` unset to keep the documented default.
- **Web app** → Vercel or Netlify with the project root set to `nuxt/`, and
  `NUXT_API_BASE` pointing at the deployed API URL.

CORS is enabled in `nest/src/main.ts` with `origin: true`, so the deployed frontend can call
the deployed API without extra configuration.

---

## With more time

- Real Logbook and More screens, and the duty-day detail page the schedule placeholder
  hints at.
- Component/store tests (Vitest + `@nuxt/test-utils`) and a Playwright pass over the range
  toggle, month navigation and mobile layout — the current safety net is the live
  `nuxt/scripts/e2e-check.mjs` script plus backend unit/e2e tests.
- Replace the hardcoded pilot with a real user store, and swap the JSON seeds for a
  database behind the same service interface (the services are already the only place that
  touches data).
- Make the JWT a short-lived access token plus a refresh token, and move the token to an
  `httpOnly` cookie so JavaScript cannot read it.
- Per-range chart rendering (line + area) with tooltips, and a proper design-system pass
  (spacing scale, shared button variants) instead of ad-hoc SCSS.
- Add API rate limiting and request-size limits at the edge.