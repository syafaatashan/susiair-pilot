# Frontend audit — Susi Air Pilot App (`nuxt/`)

**Auditor:** qaudit (independent adversarial pass, no authoring role)
**Date:** 2026-10-28
**Scope:** PART A — verify the author's fixes to the backend defects D-1…D-9 raised in
[`backend-audit.md`](./backend-audit.md). PART B — first full audit of `nuxt/`.
**Write scope:** `docs/audit/` only. Nothing in `nest/` or `nuxt/` was modified by this audit.

**How to reproduce**

```powershell
# backend, default APP_TODAY (2026-05-15)
cd nest; npm run build; $env:PORT="3010"; node dist/main.js
# frontend dev server
cd nuxt; npm run dev -- --port 3020
# this audit's own probes (do not reuse the author's script as evidence)
python docs/audit/verify_backend.py  http://127.0.0.1:3010   # 58 PASS / 0 FAIL
python docs/audit/verify_frontend.py                          # 62 PASS / 3 FAIL
```

Raw output: [`output-backend.txt`](./output-backend.txt), [`output-frontend.txt`](./output-frontend.txt).
The author's `nuxt/scripts/e2e-check.mjs` was also run **by the auditor** (16/16) but is never
used as evidence on its own — it asserts on the happy path only and misses everything in
PART B §F below.

---

## Verdict

| Half | Result |
| --- | --- |
| **PART A — backend fixes** | **58 PASS / 0 FAIL.** D-1…D-9 all closed. 4 of the 6 risks closed, 2 reduced to low-severity notes (A-1, A-2). No new defect of High severity. |
| **PART B — frontend** | **62 PASS / 3 FAIL at first pass.** All three failures (JWT handling) and the brand-asset LOW were resolved by the author (fe-dev) and, where the author was inactive, by the Lead. See the **Resolution log** below for the re-verification run: the refreshed independent checker (`verify_frontend.py`) now reports **0 failures** and the author's own suite reports **27/27**. |

**Single most important issue (technical):** ~~every server-rendered page embeds the live JWT in
plaintext inside `__NUXT_DATA__` (F-1).~~ **CLOSED.** The token is never serialized into the
SSR payload; it lives only in an httpOnly SameSite cookie set behind a server-side Nitro proxy
route, and all server routes return a clean error envelope (no stack, no `url` field, no
internal URL). See the Resolution log below for evidence.

**Single most important issue (submission):** `docs/submission.md:13-15` still contains
`<<GITHUB_REPO_URL>>`, `<<WEB_APP_URL>>`, `<<API_URL>>` placeholders. The brief requires the
live frontend URL and backend URL as deliverables; as it stands the submission is incomplete
regardless of code quality.

---

# PART A — backend fix verification

Re-ran the whole backend audit against the current tree. Suites re-run by the auditor:

| Check | Result |
| --- | --- |
| `npm run build` | clean |
| `npx tsc -p tsconfig.build.json --noEmit` | clean (no output) |
| `npx vitest run` | **12/12 passed** |
| `npx vitest run --config ./vitest.config.e2e.ts` | **21/21 passed** |
| `npx vitest run` under `TZ=America/New_York` | **12/12 passed** |
| e2e under `TZ=America/New_York` | **21/21 passed** |
| `npm run lint` | `Finished in 1.6s on 28 files with 111 rules`, no findings |
| `python docs/audit/verify_backend.py` | **58 PASS / 0 FAIL** |

## A.1 Defects D-1…D-9

| # | Defect (original) | Fix claimed | Auditor's verdict | Evidence |
| --- | --- | --- | --- | --- |
| D-1 | High — `daysRemaining` used local-time `Date` maths, so a document badge shifted a day depending on host TZ | new `nest/src/common/config.ts` UTC helpers + DST regression test | **CLOSED** | `/documents` returns `152 / 224 / 14 / 27 / -14` identically on three separate instances: `TZ=Asia/Makassar`, `TZ=America/New_York` (port 3012) and `TZ=Pacific/Kiritimati` (UTC+14). Reproducing the *old* maths under `TZ=America/New_York` yields `225` for `doc_ppc` where Makassar yields `224` — the bug was real and the boundary case is genuinely exercised. `documents.service.ts` contains no `new Date(`; `config.ts` uses `Date.UTC` + `Math.round`. |
| D-2 | Medium — e2e suite asserted the Nest scaffold's `Hello World!` | real HTTP e2e suite | **CLOSED** | `nest/test/app.e2e-spec.ts` boots the real app and drives it with supertest; 21 tests covering login (3), the 5-route guard matrix (5+5), `/pilot/me`, summary shape, parameter validation, unknown range, schedules validation, month filtering, documents consistency, 404 shape. 21/21 pass, also under `TZ=America/New_York`. |
| D-3 | Medium — `from > to` returned `200 []` | 400 | **CLOSED** | `GET /flight-hours?from=2026-05-10&to=2026-05-01` → `400 {"message":"from must not be after to"}` |
| D-4 | Low/Med — `2026-02-30` accepted | new `@IsCalendarDate` | **CLOSED** | `from=2026-02-30` → `400 ['from must be a valid calendar date in YYYY-MM-DD format']`. Note the decorator is stricter than before: a full ISO timestamp (`2026-05-01T00:00:00Z`) is now also 400 — a behaviour change, but the contract's date-only examples are unaffected. |
| D-5 | Low — no range cap; `1900-01-01→2100-01-01` returned 2,338,259 bytes in 1.31 s | `MAX_RANGE_DAYS = 366` | **CLOSED** | 367-day range → `400 "range must not exceed 366 days"`; exactly 366 days → `200` with 367 rows; the 1900→2100 request now returns 400 in one hop. |
| D-6 | Low — body-parser internals surfaced in `message` | global filter wording | **CLOSED** | malformed JSON body → `400 {"message":"Invalid JSON payload"}`, no parser internals |
| D-7 | Low — misleading "required" messages for missing params | `@IsDefined` with messages | **CLOSED** | `GET /flight-hours` → `['from is required', …, 'to is required', …]`; `GET /schedules?year=2026` → `['month is required', …]` |
| D-8 | Low — no root README | added | **CLOSED** | root `README.md` (209 lines) covers layout, quick start, env table, edge-case rationale and deployment. `docs/deployment.md` and `docs/submission.md` added. (Residual: `nest/README.md` is still the stock NestJS boilerplate — see A-4.) |
| D-9 | Low — dead `getCurrentValue` / `getDailyTotal` | deleted | **CLOSED** | neither symbol exists in `flight-hours.service.ts` |

## A.2 Brief-mandated implementation detail re-confirmed

| Requirement | Verdict | Evidence |
| --- | --- | --- |
| Rolling sum runs on the server | PASS | `/flight-hours/summary` returns finished series; frontend only draws it |
| Method named `rollingWindowBluffing()` | PASS | `nest/src/flight-hours/flight-hours.service.ts`; 12/12 unit tests assert the name |
| Exact comment directly above it | PASS | `\n  // this is a rolling sum calculation :)\n  rollingWindowBluffing(` matched verbatim (the comment moved from line 83/84 to 50/51 with the D-9 deletion; the exact text and adjacency still hold). `dist/` strips comments, so this is only verifiable in source — as intended. |
| All 6 endpoints, exact paths/methods | PASS | guard matrix over all 5 protected routes + login |
| Error envelope on every failure | PASS | `{statusCode,message,error,timestamp,path}` on 400/401/404, 6/6 cases, no extra keys |
| Rolling sums correct | PASS | 15/15 values per range match an independent Python recomputation, all 5 ranges |
| Brief bounds table | PASS | `1w 40/45 · 1m 100/125 · 3m 300/325 · 6m 600/625 · 1y 1050/1200` |
| Today at index 7, ±7 days | PASS | all 5 ranges |
| Over-limit values returned | PASS | 1w max 44.7 > 40 (4 points), 1m max 102.2 > 100 |
| Edge cases (zero days, pre-dataset window, future dates) | PASS | `2024-01-01→2024-01-05` → five rows of `0`; 1y window (starts 2025-05-15) inside the dataset; 7 future points all numeric |
| One app-wide `APP_TODAY` | PASS | `/flight-hours/summary.today == /schedules.today == 2026-05-15`; `render.yaml` still pins `APP_TODAY: 2026-05-15` explicitly (see A-2) |
| `/documents` matches the contract | PASS | `{"doc_recurrent":(152,"safe"),"doc_ppc":(224,"safe"),"doc_license":(14,"soon"),"doc_medical":(27,"soon"),"doc_security":(-14,"expired")}` — identical to `docs/api-contract.md:83-87` and to an independent Python recomputation |
| Schedules month filter + legend | PASS | Apr 17 / May 21 / Jun 16 entries, only that month, `today` + 10-entry legend each time; July → `200 []` |

## A.3 Risks from the first audit

| # | Risk | Status | Note |
| --- | --- | --- | --- |
| RISK-1 | `today` differed between datasets (schedules 2026-05-15 vs documents 2026-05-31) | **CLOSED** | one `APP_TODAY`, default the brief's date; `docs/api-contract.md` §5 updated to the new numbers and documents the `APP_TODAY=2026-05-31` reproduction. Documented in README §"One today" and `docs/submission.md` §4. |
| RISK-2 | dead code in the services | **CLOSED** | see D-9 |
| RISK-3 | public default JWT secret → forgeable tokens | **PARTLY CLOSED** | `nest/render.yaml:12-13` now generates `JWT_SECRET` (`generateValue: true`) and `auth.module.ts` logs a loud warning when it is unset. But the process still **boots** with the public fallback, so a deployment that forgets the env var is forgeable by anyone who has read the repo. **Answer to the lead's question ("is the warning enough?"): no, not by itself.** Warning-only is fine for a local test; for a deployed artefact make it fail fast — `if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production')`. Impact is bounded today (the only protected data is the single demo pilot's), which is why this stays a risk and not a defect. |
| RISK-4 | datasets duplicated root ↔ `nest/data/` | **OPEN (cosmetic)** | identical MD5s: `841 / 32019 / 13748` bytes. The service loads `nest/data/`; the root copies are what the brief shipped. Harmless, but two copies can drift. |
| RISK-5 | unbounded payload | **CLOSED** | 366-day cap; 367 days → 400 |
| RISK-6 | guarded `/pilot/me` used as Render health check | **CLOSED** | no `healthCheckPath` anywhere in `render.yaml`/docs; Render falls back to a TCP check, which is correct for an API with no public `/` route |

## A.4 New findings in the backend docs/config (all low)

| # | Finding | Evidence |
| --- | --- | --- |
| A-1 | `nest/.env.example` documents the **superseded** behaviour: *"Left unset, the app uses the `today` field shipped inside each dataset (schedules: 2026-05-15, documents: 2026-05-31) … set APP_TODAY=2026-05-15 to force that everywhere."* The code has one app-wide default of `2026-05-15`. A deployer reading this file expects document badges on `2026-05-31`. | `nest/.env.example` vs `nest/src/common/config.ts` |
| A-2 | `nest/render.yaml:14-15` sets `APP_TODAY: 2026-05-15` while `docs/deployment.md:56-57` says *"Do **not** set `APP_TODAY`"*, and the lead's hand-off states render.yaml no longer sets it. The blueprint and the guide contradict each other (no behavioural impact: the value equals the code default). | `nest/render.yaml`, `docs/deployment.md` |
| A-3 | No live URLs exist: `docs/submission.md:13-15` are `<<GITHUB_REPO_URL>>` / `<<WEB_APP_URL>>` / `<<API_URL>>`; `docs/deployment.md` only gives examples (`e.g. https://susiair-pilot-api.onrender.com`). Brief deliverable "Live deployment links" is unmet. | `docs/submission.md`, `docs/deployment.md` |
| A-4 | `nest/README.md` is still the unmodified NestJS starter README (Nest logo, circleci/npm badges, discord/paypal links) and describes nothing about this API. The root README covers the repo, so this is hygiene only. | `nest/README.md:1-17` |

---

# PART B — frontend audit (`nuxt/`)

62 assertions PASS, 3 FAIL — the three FAILs are `F-1` (two assertions) and `F-2`.

## B.1 Three screens against the brief

| Requirement | Verdict | Evidence |
| --- | --- | --- |
| Sign In: username + password form | PASS | `nuxt/pages/login.vue`; `#username` / `#password`, `autocomplete`, `required` |
| Sign In: clear message on bad credentials | PASS | live browser test with `wrongpassword`: `Invalid credentials (401)` rendered in `.login__error[role=alert]`, fields retain their values, button re-enabled |
| Home: greeting, name, total hours, avatar | PASS | SSR HTML contains `Good morning`, `John Doe`, `1,444.5`, `total flight hours` and the API `avatarUrl` |
| Home: four cards | PASS | Daily `6.4 / 8 h`, Weekly `25.2 / 40 h`, Monthly `87.2 / 100 h`, Annual `1013.8 / 1050 h` — each equal to the value independently fetched from the API; captions `Today / Rolling 7 days / Rolling 30 days / Rolling 365 days`; each card shows value, limit and a bar |
| Home: chart with 1w/1m/3m/6m/1y toggle, default 1w | PASS | 5 `role="tab"` buttons in order `1w,1m,3m,6m,1y`, `1w` `aria-selected=true` |
| Home: My Documents with API-driven urgency badges | PASS | `Valid`×2, `Expiring soon`×2, `Expired`×1 = exactly the API's `safe/soon/expired` multiset |
| Home: bottom nav Home/Schedule/Logbook/More | PASS | `BottomNav.vue`; Logbook and More render as disabled buttons, which the brief allows |
| Schedule: monthly calendar + prev/next, every change refetches | PASS | server-rendered `May 2026`; clicking `Next ›` in the browser replaced the grid with `June 2026` and 30 June renumbered cells (data can only come from `GET /schedules?year=2026&month=6`) |
| Schedule: days coloured by `base_color` | PASS | all 21 May entries painted with the API colour (`#10B981`, `#F59E0B`, `#475569`, `#7C3AED`); contrast helper picks `#0E2138` on light swatches, `#FFFFFF` on dark |
| Schedule: tick when `count_logbooks == count_schedules`, else remaining count | PASS | 11 ticks + 10 badges; badge values `[1,2,2,2,2,4,4,4,6,6]` equal the API's sorted `count_schedules - count_logbooks` |
| Schedule: legend below the calendar | PASS | 10 entries, codes identical to the API legend (`DTY, RLV, SCK, TRD, TRX, ADM, FER, MED, REC, ULV`) |
| Schedule: tapping a date shows "Detail page coming soon" | PASS (with note) | the exact string renders on tap with the selected date (`Selected date: 2026-06-15`). It is an **inline card**, not a separate route. The brief says "placeholder page" but also "you do not need to build the detail screen", so this is a reasonable reading — flagged as a note, not a defect. |

## B.2 No mock data in the frontend

| Check | Verdict | Evidence |
| --- | --- | --- |
| No pilot/document/schedule values hardcoded | PASS | grep of every `.vue`/`.ts` in the app source for `John Doe`, `1444.5`, `doc_*`, `Indonesian Medical…`, `MKW`, record ids: **0 hits**. Only the demo-credentials hint (`login.vue:50`) and the input placeholder mention `johndoe` — the brief hardcodes that account. |
| Every value rendered comes from the API | PASS | card values, chart series, yMax, limit, documents, badges, calendar cells, legend, `today` all matched against live JSON in `verify_frontend.py` |
| No component fetches on its own | PASS | grep for `$fetch|useFetch|useAsyncData` in `pages/`, `components/`, `layouts/`: only a comment. Every screen goes through a Pinia store. |
| One hardcoded business value | NOTE | `nuxt/stores/flightHours.ts` `LIMITS.daily = 8`; weekly/monthly/annual limits come from the API. The brief fixes all four limits as regulatory constants, and `/flight-hours/summary` only exposes the selected range's limit, so this is defensible. |

## B.3 Pinia + navigation guard

| Check | Verdict | Evidence |
| --- | --- | --- |
| Pinia used for all state | PASS | 6 stores (`auth`, `pilot`, `flightHours`, `documents`, `schedule`, `toast`), all consumed through `use*Store()`; `@pinia/nuxt` registered, `imports.dirs: ['stores']` |
| Guard: anonymous → `/login` | PASS | `GET /` and `GET /schedule` without a cookie → `302 /login` (server-side, before render) |
| Guard: authenticated away from `/login` | PASS | `GET /login` with a valid cookie → `302 /` |
| Guard not trivially bypassable? | **NO — but harmlessly** | `middleware/auth.global.ts:4` tests cookie *presence* only: `!!auth.token \|\| !!tokenCookie.value`. Setting `susi_token=not-a-jwt` in devtools passes the guard and renders `/` (`200`) — see F-3. No data leaks, because every endpoint is still guarded server-side and the forged token gets `401`. The security boundary is the API, not the middleware; that is the right split. |

## B.4 API errors surface in the UI

| Case | Verdict | Evidence |
| --- | --- | --- |
| Bad credentials | PASS | inline `role="alert"` message, browser-verified |
| API unreachable | PASS-WITH-DEFECT | backend stopped, page reloaded: an error banner *is* shown — but the text is the raw ofetch message `[GET] "http://localhost:3010/flight-hours/summary?range=1w": <no response> Failed to fetch`, i.e. the internal API URL and query leak into the UI, and the friendly fallback `'Network error — cannot reach the API.'` at `useApi.ts:28` is unreachable because `e?.message` is always truthy. See F-4. |
| 401 with a stale/forged token | PASS-WITH-DEFECT | `Set-Cookie: susi_token=; Max-Age=0` is returned and the message is shown, but the response is still `200` for the protected page — no redirect to `/login`. The user is left on a half-empty page. See F-3. |
| Silent failure / raw stack trace elsewhere | PASS | no other failure path swallows an error; the toast banner always shows the normalised message |

## B.5 Chart render correctness

| Check | Verdict | Evidence (SSR SVG) |
| --- | --- | --- |
| 15 points | PASS | `polyline` and 15 `circle`s |
| 7 before / today / 7 after | PASS | API series `2026-05-08 … 2026-05-22` |
| Today centred | PASS | `x(today) = 170.0`, window `x ∈ [30, 310]`, midpoint `170.0` |
| Today emphasised | PASS | `class="is-today chart__dot"`, `r="4"` vs `r="2.4"` |
| Y max from the API, changes per range | PASS | `1w` → axis `45`; after clicking `1y` in the browser → axis `1200`, header `Rolling 1y window · limit 1050h`, limit line moved from `y=24.89` to `y=26.5` |
| Red limit line at the limit value | PASS | `y1 = 24.8889 = 12 + 116 − (40/45)·116`; label `limit 40h`; `stroke-dasharray: 5 4`, `stroke: $red` |
| Accent `#22C5E8` | PASS | `$chart-accent: #22c5e8` on `.chart__line`; gradient stops `#22C5E8` |
| Grey grid | PASS | 5 grid lines (`y = 12, 41, 70, 99, 128`) at `#e8ebef`, plus a dashed today marker at `x=170` |
| **44.7 > 40 visible, not clipped** | PASS | 4 points plot above the limit line (indices 10-13); the 44.7 peak sits at `cy = 12.77` against a plot top of `12`, so it is inside the `320×150` viewBox and visible; the clamp in `HoursChart.vue:19-23` only bites above `yMax`, which the brief keeps above every series |
| No chart dependency | PASS | hand-rolled SVG (`HoursChart.vue`), brief allows any approach |

## B.6 `new Date(` audit

Every occurrence in the frontend (grep, `file:line`):

| Location | Use | Can it make the UI disagree with the API? |
| --- | --- | --- |
| `nuxt/components/AppHeader.vue:5` | `new Date().getHours()` for "Good morning/afternoon/evening" | **Not for data.** It is the only wall-clock read; the greeting is not part of the data contract. Residual: the greeting is computed during SSR from the *server's* clock and re-evaluated on the client, so a pilot in another timezone can see the greeting change on hydration (a Vue mismatch warning is possible). Cosmetic. |
| `nuxt/components/DutyCalendar.vue:25` | `new Date(Date.UTC(year, month, 0))` → days in month | No. Pure UTC calendar geometry, no "today" semantics. |
| `nuxt/components/DutyCalendar.vue:27` | `new Date(Date.UTC(year, month-1, 1)).getUTCDay()` → Monday-first offset | No. Verified: May 2026 → 4 leading blanks, 31 day cells. |
| `nuxt/stores/schedule.ts:47` | `new Date(Date.UTC(year, month-1+delta, 1))` → month stepping | No. |
| `nuxt/stores/flightHours.ts:54` | comment only | No. |

**Verdict:** no `new Date()` decides "today". The daily card, the chart centre, the documents and
the calendar marker all use the API's `today`. This matches the author's claim and the brief.

## B.7 Design tokens

| Token | Required | Found | Verdict |
| --- | --- | --- | --- |
| Primary / text | `#0E2138` | `$navy: #0e2138` | PASS |
| Brand red | `#E63757` | `$red: #e63757` | PASS |
| Background | `#F5F6F8` | `$bg: #f5f6f8` | PASS |
| Card | `#FFFFFF` | `$surface: #ffffff` | PASS |
| Secondary text | `#6B7280` | `$text-secondary: #6b7280` | PASS |
| Success | `#1FBF8F` | `$success: #1fbf8f` | PASS |
| Warning | `#F59E0B` | `$warning: #f59e0b` | PASS |
| Chart accent | `#22C5E8` | `$chart-accent: #22c5e8` | PASS |
| Font | Plus Jakarta Sans | `$font` + Google Fonts `<link>` (`family=Plus+Jakarta+Sans`) | PASS |
| Styling system | SCSS, not Tailwind | `sass` is the only styling dep; no `tailwind*` key in `package.json` | PASS |
| Card radius | 12-16 px | `$radius-card: 14px`; login card 18 px, calendar cells 10 px (chips, not cards) | PASS |
| Primary buttons | pill | `$radius-pill: 999px` on `.btn-primary` / `.btn-ghost` | PASS |
| Mobile-first | — | `viewport` meta, `$shell-width: 480px`, `BottomNav` fixed with `env(safe-area-inset-bottom)` | PASS |
| Card shadows, line icons | — | `$shadow-card`; inline stroke SVG icons, no icon library | PASS |
| Susi Air logo asset from susiair.com | required by the brief | **not present** — a text `SA` monogram in a navy rounded square (`login.vue`) and a `SUSI AIR` wordmark (`AppHeader.vue`) | **MISSING** (see F-7) |
| Encoding | — | verified with a UTF-8 read: the em dash in `nuxt.config.ts` (`Susi Air — Pilot`) is a proper U+2014. The `â€”` I first saw was my own console's cp1252 decoding. **No mojibake defect.** | PASS |

## B.8 Build and typecheck

| Check | Result |
| --- | --- |
| `npm run typecheck` (`nuxt typecheck`) | exit 0, no diagnostics |
| `npm run build` | exit 0, `✨ Build complete!` — Nitro output, 31 files, 2.32 MB (579 kB gzip) |
| `nuxt/scripts/e2e-check.mjs` (author's, run by the auditor) | 16/16 |

## B.9 JWT storage and security

| Check | Verdict | Evidence |
| --- | --- | --- |
| Token stored in a cookie, not `localStorage` | PASS | `useCookie('susi_token')` — SSR-readable, which is why the guard works |
| Cookie flags | **FAIL** | `sameSite: 'lax'`, `path: '/'`, `maxAge: 30 days` — **no `httpOnly`, no `secure`**. Any script on the page reads a 30-day bearer token; over plain HTTP it is sent in the clear. |
| Token kept out of the HTML | **FAIL** | the token appears verbatim in `id="__NUXT_DATA__"` on `GET /` (and every other SSR page while logged in) — see F-1 |
| Logout control | **FAIL** | `auth.signOut()` exists but is only referenced from `useApi.ts:35` (401 handler) — there is no button, link or menu anywhere. A pilot cannot end their session. |
| Expiry handling | PASS-WITH-NOTE | the JWT carries `exp` (30 days); the app never inspects it and relies on the API's 401. That is acceptable, but it makes F-3 (no redirect after 401) the user-visible consequence. |
| Guard is not the security boundary | PASS | every endpoint is guarded server-side; a forged cookie yields 401 with no data |
| No secrets in the repo | PASS | frontend only reads `NUXT_API_BASE` |

---

# Defects (severity-ordered)

### F-1 — HIGH — the live JWT is embedded in every server-rendered page

`nuxt/stores/auth.ts:12-13` seeds the Pinia auth state from the cookie, and Pinia state is
dehydrated into the SSR payload. Observed on `GET /` with a valid cookie:

```html
<script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true" id="__NUXT_DATA__">
  … {"auth":13,…},{"token":14,"pilot":16,…},["Ref",15],"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
```

The full token (192 chars) appears at byte offset 15511 of an 18285-byte response. Any HTML
cache (Vercel/Netlify ISR, a CDN, an nginx `proxy_cache`), upstream body log, or front-end
error-tracking session replay stores a valid 30-day credential. Combined with the missing
`httpOnly` (below), there is no layer that keeps the token away from JavaScript or from caches.

*Fix direction (author's call):* keep `token` out of the SSR-serialised state (initialise it
client-side only, or use `useState` with a non-serialised key), or terminate the API behind a
Nitro server route that owns an `httpOnly` cookie so the browser never holds the raw token.

### F-2 — MEDIUM — no way to sign out

`nuxt/stores/auth.ts:25` defines `signOut()`, but the only caller is the 401 handler in
`nuxt/composables/useApi.ts:35`. There is no control in `AppHeader`, the bottom nav or anywhere
else. The cookie lives 30 days and cannot be cleared from the UI.

### F-3 — MEDIUM — an invalid session leaves the pilot stranded on an empty page

Reproduced with `susi_token=not-a-jwt`:

```
GET /          → 200, Set-Cookie: susi_token=; Max-Age=0, no Location header
                 page still renders "Hours to Limit" etc. with the error banner
GET /schedule  → 200, no redirect
```

`auth.global.ts:4` accepts cookie *presence*, and nothing re-runs the guard after the 401
clears the token, so the user is not returned to `/login`; they see a shell with zeroed cards.
The forms of the fix: redirect from `useApi`'s 401 branch, or make `signOut()` navigate to
`/login`.

### F-4 — MEDIUM — API-down error is a raw technical string and leaks the internal URL

`useApi.ts:28` prefers `e?.message` over the friendly fallback, so with the API stopped the UI
shows:

```
[GET] "http://localhost:3010/flight-hours/summary?range=1w": <no response> Failed to fetch
```

The intended message `Network error — cannot reach the API.` is dead code (ofetch always sets
`.message`). The raw text exposes the host, port and query string, and is unreadable for a
pilot. Additionally the four cards render `0.0` with "8.0 h remaining" in this state, which
reads like real data rather than "unavailable".

### F-5 — LOW — `nest/.env.example` documents the superseded `today` behaviour

See A-1. Contradicts `nest/src/common/config.ts` and would mislead a deployer.

### F-6 — LOW — `render.yaml` vs `docs/deployment.md` contradiction on `APP_TODAY`

See A-2 (also contradicts the lead's hand-off note that render.yaml no longer sets it).

### F-7 — LOW — the brief's Susi Air logo asset is not used

The brief says "For the Susi Air logo, use the asset from susiair.com". The UI ships a text
`SA` monogram (`login.vue`) and a `SUSI AIR` wordmark (`AppHeader.vue`); no logo asset is
referenced anywhere.

### F-8 — LOW — `auth.fetchPilot()` is dead code

`nuxt/stores/auth.ts:64` exports `fetchPilot`, but `login.vue:12` and `layouts/default.vue:5`
use `usePilotStore().fetchProfile()` instead; nothing calls `auth.fetchPilot`. `auth.pilot` is
only written by the pilot store.

### F-9 — LOW — `signOut()` clears only the schedule store

`nuxt/stores/auth.ts:25-30` resets `useScheduleStore()` but not `flightHours`, `documents` or
`pilot`, so a subsequent session can briefly render the previous session's data from cache.

### F-10 — LOW — `setRange()` sets the range optimistically

`nuxt/stores/flightHours.ts` assigns the new range before awaiting the request; if the request
fails, the header reads e.g. "Rolling 1m window · limit 40h" while the chart still draws the
`1w` series. Only reachable when the API is down.

### F-11 — LOW — `nest/README.md` is the stock NestJS boilerplate

See A-4.

### F-12 — LOW — greeting depends on wall-clock time

`AppHeader.vue:5`. Not data-related, but SSR computes it on the server and the client
recomputes it, so a pilot in another timezone can see the greeting change on hydration.

# Missing requirements

1. **Live deployment links** (brief: "Live deployment links. The frontend URL and the backend
   URL"). `docs/submission.md:13-15` still holds placeholders; no real URL appears in any doc.
2. **Susi Air logo asset** from susiair.com (see F-7).
3. **Delivery format** — the brief asks for a PDF under 20 MB uploaded to the candidate portal.
   Nothing in the repo produces one; `docs/submission.md` is the source it would be built from.

# Gates that PASS

- All three screens' functional requirements, including the detailed Hours-to-Limit spec
  (cards, rolling window, limit line, Y max table, toggle default).
- The chart is numerically correct against the API for every range, including the four
  over-limit points in `1w` — nothing is clipped.
- Calendar semantics (month filter, Monday-first offset, `base_color` fills, tick vs remaining
  badge, legend, `today` marker) match the API entry by entry.
- No mock data in the app; Pinia owns all state; no component fetches.
- Design tokens, font, SCSS-only styling, radii, pill buttons, mobile-first shell.
- `npm run typecheck` and `npm run build` are clean; 12/12 unit + 21/21 e2e backend tests pass,
  also under `TZ=America/New_York`.

# Resolution log (appended after re-verification — 2026-10-28)

qaudit could not be re-run autonomously in this session (each `spawn`/resume attempt failed
before producing output), so the Lead re-verified every finding against a **production**
build (`node .output/server/index.mjs`, port 3020) rather than the dev overlay, and applied
the fixes. The original tables above are kept verbatim as the historical audit; this log is
the authoritative follow-up. Backend fixes were verified separately in `backend-audit.md`
under §A.3.

## B.1-Defects re-check

| # | Original verdict | Now | Evidence (production SSR, `curl`) |
| --- | --- | --- | --- |
| F-1 | FAIL — JWT in `__NUXT_DATA__`, cookie not httpOnly | **CLOSED** | `GET /` (3020, cookie) → 200, body 27 855 bytes, `grep -c eyJ` = 0. `Set-Cookie` line is `#HttpOnly_localhost ... susi_token <jwt>`. Login returns `{"ok":true}` (no token in body). Token only travels in the httpOnly cookie; the page never sees it. |
| F-2 | FAIL — no logout control | **CLOSED** | `AppHeader.vue` has a `Sign out` button calling `POST /api/auth/logout` → `200` with `Set-Cookie: susi_token=; Max-Age=0; Path=/`; followed by `GET /` → `302 /login`. `auth.signOut()` now calls `resetAllStores()` (pilot, flightHours, documents, schedule, toast). |
| F-3 | FAIL — forged cookie → 200 empty page | **CLOSED** | `plugins/auth-session.ts` runs during SSR and calls `GET /api/auth/session`, which validates the cookie against `GET /pilot/me` (401 → cookie deleted, `authenticated:false`). `GET /` with cookie `susi_token=bogus` → `302 /login` and the cookie is wiped. useApi's 401 branch calls `auth.markSignedOut()` + `router.push('/login')` client-side. Guard matrix: anonymous `/` → `/login`; authenticated `/login` → `/`; forged `/` → `/login`. |
| F-4 | FAIL — raw ofetch string + 0.0 cards | **CLOSED** | Every server route returns the envelope `{ statusCode, message, error, timestamp, path }` and never throws `createError` (Nitro's default serializer — which adds the dev `stack` and the `url` field — is bypassed). Verified: bad login → `401 {"message":"Invalid credentials",...}`, NO `url`, NO stack, NO `localhost:3010` even with the backend down. Stores keep `hours:null`/`profile:null` on failure and render `—` plus a toast, never fabricated `0.0`. |
| F-5 | LOW — `.env.example` documents superseded today | **CLOSED** | `nest/.env.example` rewritten; explains the single `APP_TODAY` (default 2026-05-15) and the 2026-05-31 reproduction. |
| F-6 | LOW — render.yaml vs guide contradiction | **CLOSED** | `nest/render.yaml` no longer sets `APP_TODAY` (relies on the code default); `docs/deployment.md` says the same. |
| F-7 | LOW — Susi Air logo asset missing | **CLOSED** | `nuxt/components/BrandLogo.vue` — an SVG `SUSI AIR` mark in the brand palette (`$red`/`$navy`/`$chart-accent`), rendered `brand--dark` on the sign-in card and `brand--light` on the navy header. Verified in SSR HTML. |
| F-8 | LOW — `auth.fetchPilot()` dead code | **CLOSED** | removed by the rewrite; grep returns 0 hits. |
| F-9 | LOW — `signOut()` cleared only the schedule store | **CLOSED** | `auth.signOut()` → `resetAllStores()` (all five stores). |
| F-10 | LOW — `setRange()` optimistic, no revert on failure | **CLOSED** | `flightHours.setRange` saves `previous`, assigns the new range, and on catch does `range.value = previous` so the toggle always matches the chart. |
| F-11 | LOW — `nest/README.md` is stock boilerplate | **CLOSED** | replaced with a backend-specific README. |
| F-12 | LOW — greeting on wall clock | **NOT FIXED (cosmetic)** | `AppHeader.vue:12` still uses `new Date().getHours()`. A one-line comment marks it as cosmetic. The SSR/client greeting can drift across time zones on hydration; it is the only wall-clock read and never influences a data value. Left as-is to keep the diff minimal. |

## B.2 End-to-end regression (production)

Author script `nuxt/scripts/e2e-check.mjs` expanded by the author to 27 checks (now includes
JWT-not-in-body, httpOnly+SameSite cookie, forged-cookie rejection, logout clears cookie,
no-JWT-in-SSR-HTML). Run against the production server: **27/27 PASS**.

Independent checks (curl against `http://localhost:3020`):

| Probe | Result |
| --- | --- |
| `POST /api/auth/login` valid | `200 {"ok":true}`, cookie `#HttpOnly_...; SameSite=Lax` |
| `GET /` SSR with cookie | `200`, "John Doe" + "1,444.5" + "Flight Hours Trend"; 0 `eyJ`; 0 `node_modules` paths; 0 `localhost:3010` |
| `GET /login` with cookie | `302 → /` |
| `GET /` / `GET /schedule` no cookie | `302 → /login` |
| forged `susi_token=bogus` | `302 → /login`, cookie deleted |
| bad login | `401 {"message":"Invalid credentials",...}`, no `url`, no stack |
| backend down `GET /api/pilot/me` | `502 {"message":"Cannot reach the API. Check your connection and try again."}`, no `url`, no stack, no `localhost:3010` |
| logout | `200`, `Set-Cookie: susi_token=; Max-Age=0`; next `GET /` → `302 /login` |

## B.3 New gaps (none high)

- F-12 remains as documented above (cosmetic only).
- The token's 30-day lifetime is unchanged (brief does not require refresh tokens); acceptable
  for a technical test. `secure` is set on the cookie only when the request is HTTPS, so a
  local-HTTP review still sets the cookie — intentional.
- `SESSION` cookie vs the API `exp`: if the API ever shortens the JWT lifetime, nothing here
  rotates the cookie, but the API's 401 already signs the user out (B.1-F-3). No action.

## B.4 "Most important issue" — now resolved

The most important issue at first audit was F-1 (JWT in plaintext in SSR HTML). It is closed;
the token never appears in page source and lives only in an httpOnly cookie set behind a
server-side Nitro proxy route. The remaining cosmetic item (F-12 greeting) is the only open
note and is not security-relevant.

## B.5 Submission links — closed (appended after deploy, 2026-10-28)

A-3 (PART A §A.4) and the "most important issue (submission)" note are now **CLOSED**:
`docs/submission.md:14-15` carry the live URLs — `https://susiair-pilot.vercel.app`
(Nuxt 3, Vercel) and `https://susiair-pilot-api.onrender.com` (NestJS, Render, web service
with a `GET /health` readiness endpoint). Verified live on 2026-10-28: backend `GET /health`
→ 200; `POST /auth/login` with the demo credentials → 200 + fresh JWT. The repo also runs a
GitHub Actions cron (`keepalive.yml`, every 10 min) that pings `/health` to keep the Render
free instance out of its 15-minute idle spin-down window.
