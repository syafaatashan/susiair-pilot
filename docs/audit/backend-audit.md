# Backend Audit — Susi Air Pilot App (`nest/`)

Auditor: `qaudit` (independent; did not write the audited code). Date of audit: 2026-10-28.
Scope: `nest/src/**`, `docs/api-contract.md`, `mock-*.json` (root and `nest/data/`), brief
`C:\Users\M SYAFA'AT ASHAN\AppData\Local\Temp\susiair_brief.txt`.
Nothing under `nest/` was modified. Reproducer: [`verify_backend.py`](./verify_backend.py).

Command used to run the audited build (port 3000 was not used; 3010 per instruction):

```powershell
cd "E:\Deeseek-Harness\Susi Air\nest"; npm run build
$env:PORT="3010"; node dist/main.js
```

Reproduction:

```powershell
python "E:\Deeseek-Harness\Susi Air\docs\audit\verify_backend.py" http://127.0.0.1:3010
```

## Verdict summary

| Result | Count |
|---|---|
| PASS | 46 |
| FAIL | 1 |
| RISK | 6 |

`FAILURES: ['documents daysRemaining is timezone-independent']` — the only failing assertion in the
reproducer. Everything else in tasks 1–12 passes, including all rolling-sum maths.

**Note on workspace churn.** The workspace was being edited by other team members while this audit ran:
`nest/Dockerfile`, `nest/render.yaml` and several `nuxt/**` files appeared during the session (the
backend endpoints, DTOs and services under audit did not change after the first read; their hashes are
listed below). Line numbers below refer to the files as read at 2026-10-28T02:31–02:36Z. Re-run
`verify_backend.py` against the final build before submitting.

Hashes of the audited backend sources (for re-verification):

```
git -C "E:\Deeseek-Harness\Susi Air" rev-parse HEAD   # b684cf43a43a39093a52e5fb9277f6ae290c18e2
```

---

## 1. Endpoint coverage — PASS

| # | Check | Result | Evidence |
|---|---|---|---|
| 1.1 | `POST /auth/login` exists, 200 + token | PASS | `curl -s -X POST -H "Content-Type: application/json" --data-raw '{"username":"johndoe","password":"susiairtest"}' http://127.0.0.1:3010/auth/login` → `{"access_token":"eyJ…","token_type":"Bearer","expires_in":2592000}` |
| 1.2 | `GET /pilot/me` exists, 200 | PASS | `nest/src/pilot/pilot.controller.ts:10-13`; live 200 `{"name":"John Doe","totalFlightHours":1444.5,"avatarUrl":…}` |
| 1.3 | `GET /flight-hours?from=&to=` exists, 200 | PASS | `nest/src/flight-hours/flight-hours.controller.ts:11-14`; live `[…5 rows…]` |
| 1.4 | `GET /flight-hours/summary?range=` exists, 200 | PASS | `flight-hours.controller.ts:16-19`; live 200 with `chartData` |
| 1.5 | `GET /documents` exists, 200 | PASS | `nest/src/documents/documents.controller.ts:10-13`; live 200, 5 items |
| 1.6 | `GET /schedules?year=&month=` exists, 200 | PASS | `nest/src/schedules/schedules.controller.ts:11-14`; live 200 |
| 1.7 | No global prefix, paths exactly as in brief | PASS | `nest/src/main.ts` has no `setGlobalPrefix`; contract `docs/api-contract.md:3` agrees |

All 6 brief endpoints exist with the exact method + path. `/auth/login` is `POST` with `@HttpCode(200)`
(`auth.controller.ts:9-10`), so it returns 200 rather than the Nest default 201 — matches the contract.

## 2. Auth guard coverage — PASS

`JwtAuthGuard` is registered at controller level: `pilot.controller.ts:6`, `flight-hours.controller.ts:7`,
`documents.controller.ts:6`, `schedules.controller.ts:7`. `AuthController` has no guard.

| Endpoint | no token | malformed token (`Bearer not.a.jwt`) | valid token |
|---|---|---|---|
| `/pilot/me` | **401** | **401** | 200 |
| `/flight-hours?from=2026-05-01&to=2026-05-02` | **401** | **401** | 200 |
| `/flight-hours/summary` | **401** | **401** | 200 |
| `/documents` | **401** | **401** | 200 |
| `/schedules?year=2026&month=5` | **401** | **401** | 200 |
| `/auth/login` (control) | 200 | n/a | 200 |

Verified live with `curl` and asserted by `verify_backend.py` (guard matrix section). Guard body:
`jwt-auth.guard.ts:24-34` — accepts only `Authorization: Bearer `, verifies with `JwtService`, throws
`UnauthorizedException('No bearer token provided')` / `('Invalid or expired token')`.
A forged token signed with the default secret is accepted (see RISK-5).

## 3. Token issuance — PASS

| Check | Result | Evidence |
|---|---|---|
| Exact credentials `johndoe` / `susiairtest` accepted | PASS | `auth.service.ts:5,12`; live 200 |
| Wrong password rejected 401 `Invalid credentials` | PASS | live `{"statusCode":401,"message":"Invalid credentials",…}` |
| Wrong username rejected 401 | PASS | `{"username":"jane",…}` → 401 |
| Token verifiable | PASS | `verify_backend.py` re-computed the HMAC: HS256, `sub=72159`, `username="johndoe"`, `role="pilot"`, `exp-iat=2592000` (30 d), signature matches `susiair-technical-test-secret` |
| Response shape matches contract | PASS | keys exactly `access_token`, `token_type`, `expires_in`; `auth.service.ts:16-20` |
| Missing/blank username+password → 400 | PASS | body `{}` → `["username must be longer than or equal to 1 characters",…]` |
| `GET /auth/login` is not a route | PASS | 404 (`auth.controller.ts` declares only `@Post`) |

## 4. DTO validation — PASS with caveats

Live results (`Authorization: Bearer <jwt>` unless noted):

| Request | Status | `message` |
|---|---|---|
| `/flight-hours?from=abc&to=2026-05-05` | 400 | `["from must be a valid ISO 8601 date string"]` |
| `/flight-hours?from=2026-05-01&to=xyz` | 400 | `["to must be a valid ISO 8601 date string"]` |
| `/flight-hours?from=2026-05-01` (to missing) | 400 | `["to must be a valid ISO 8601 date string"]` |
| `/flight-hours` (both missing) | 400 | array of both messages |
| `/flight-hours/summary?range=2w` | 400 | `["range must be one of the following values: 1w, 1m, 3m, 6m, 1y"]` |
| `/flight-hours/summary?range=` (empty) | 400 | same |
| `/flight-hours/summary?range=1W` (case) | 400 | same |
| `/flight-hours/summary?range=1w&range=1m` (array) | 400 | same |
| `/flight-hours/summary` (omitted) | 200 | defaults to `1w` (`query.dto.ts:15`, `main.ts:11-15` `transform: true`) |
| `/schedules?year=2026&month=0` | 400 | `["month must not be less than 1"]` |
| `/schedules?year=2026&month=13` | 400 | `["month must not be greater than 12"]` |
| `/schedules?year=2026&month=abc` | 400 | `["month must not be greater than 12","month must not be less than 1","month must be an integer number"]` |
| `/schedules?year=2026&month=5.5` | 400 | `["month must be an integer number"]` |
| `/schedules?month=5` (year missing) | 400 | `["year must not be greater than 2100","year must not be less than 2000","year must be an integer number"]` |
| `/schedules?year=1999&month=5` | 400 | `["year must not be less than 2000"]` |
| `/schedules?year=2026&month=005` | 200 | accepted, normalised to `month: 5` (defensible) |

Error **shape** is consistent: every failure returns exactly
`{statusCode, message, error, timestamp, path}` with `message` a string or string array.

Caveats (see defects D-3 and D-4):
* Missing params produce "must be a valid ISO 8601 date string" / "must not be greater than 2100"
  instead of "is required" — technically compliant, poor for a client.
* `2026-02-30` is accepted (JS normalises to 2026-03-02), i.e. impossible calendar dates pass validation.

## 5. Global exception filter — PASS (limit: 500 not reachable from this source)

Registered once for the whole app: `main.ts:17` `app.useGlobalFilters(new GlobalExceptionFilter())`;
implementation `common/exception.filter.ts:4-53`.

| Status | Trigger used | Body | Shape OK |
|---|---|---|---|
| 400 | validation + body-parser | `{"statusCode":400,"message":[…],"error":"Bad Request","timestamp":…,"path":…}` | PASS |
| 401 | no/malformed token, bad credentials | `{"statusCode":401,"message":"No bearer token provided",…}` | PASS |
| 404 | `GET /nope` | `{"statusCode":404,"message":"Cannot GET /nope","error":"Not Found",…}` | PASS |
| 500 | **could not be triggered** | — | static review only |

The 500 branch is `exception.filter.ts:26-28`: for a non-`HttpException` `Error`, the real message is
logged (`this.logger.error(exception.message, exception.stack)`) but the client body is hard-coded to
`'Internal server error'` (`line 14`, `line 28`). `getErrorName(500)` → `'Internal Server Error'`.
No stack, file path, or internal identifier is returned.

Probes attempted to force a 500 (all handled cleanly, none leaked): `null` / `"abc"` / `5` / `true` JSON
bodies, `{}`, `[]`, missing `Content-Type`, malformed JSON `{oops`, duplicate query params
(`from=…&from=…`), `month=abc`, `year=abc`, `range=1W`, huge ranges, unknown routes, `//documents`.
A second 404 source lives inside the filter: `404: 'Not Found'` (`exception.filter.ts:47`).

Residual leak that does reach clients: body-parser's message is passed through verbatim, e.g.
`"Unexpected token 'n', \"null\" is not valid JSON"` and `"Expected property name or '}' in JSON at
position 1 (line 1 column 2)"`. No stack/path, so low severity (D-6).

## 6. `rollingWindowBluffing()` naming and comment — PASS

`nest/src/flight-hours/flight-hours.service.ts`, exact lines quoted (no reflow — the comment is on the
line directly above the method):

```
83:  // this is a rolling sum calculation :)
84:  rollingWindowBluffing(startDateStr: string, endDateStr: string, windowDays: number): ChartPoint[] {
```

* Method name is exactly `rollingWindowBluffing` — no typo, no suffix.
* Comment text is exactly `// this is a rolling sum calculation :)` including the single space after `//` and the trailing `:)`.
* It is the method that performs the rolling sum (`service.ts:85-101`), called by `getSummary` (`:56`) and `getCurrentValue` (`:73`).
* Compiled output confirms it ships: `dist/flight-hours/flight-hours.service.js:77`
  (`rollingWindowBluffing(startDateStr, endDateStr, windowDays) {`). The comment itself is stripped by `tsc` in `dist/`, which is expected — the requirement is on the source.
* `nest/test/flight-hours.spec.ts:106-107` asserts the method name exists.

## 7. Rolling-sum maths — PASS (all five ranges, independently recomputed)

Recomputed in Python from `mock-flight-hours.json` with `datetime.date` only — the TypeScript logic was
not consulted. Window = the point's own day plus the `windowDays-1` preceding calendar days; dates
absent from the dataset contribute `0`; result rounded to 1 decimal.

| range | window | limit | yMax | points | today index | API vs Python |
|---|---|---|---|---|---|---|
| 1w | 7 d | 40 | 45 | 15 | 7 | PASS (0 mismatches) |
| 1m | 30 d | 100 | 125 | 15 | 7 | PASS |
| 3m | 90 d | 300 | 325 | 15 | 7 | PASS |
| 6m | 180 d | 600 | 625 | 15 | 7 | PASS |
| 1y | 365 d | 1050 | 1200 | 15 | 7 | PASS |

* Chart series: `chartData` is always 15 points, first = `today-7d` (`2026-05-08`), index 7 = `2026-05-15` = `today`, last = `today+7d` (`2026-05-22`). Asserted per range in the reproducer.
* `limit`/`yMax` match the brief's bounds table exactly (40/45, 100/125, 300/325, 600/625, 1050/1200), sourced from `chartBounds` in `mock-flight-hours.json`, surfaced at `service.ts:61-62`.
* Values (all five ranges, from the live API):

```
1w  [15, 15, 16.6, 12.6, 16.3, 22.2, 24, 25.2, 31.4, 36.4, 42.8, 44, 44.7, 42.7, 36.3]
1m  [102.2, 96.4, 92.5, 86.9, 85.3, 84.8, 87, 87.2, 87.6, 88, 89.3, 92.6, 96.2, 100.9, 98.7]
3m  [252.3, 249.3, 245.1, 240.2, 239.7, 239.3, 241.2, 247.6, 247.4, 254, 254.9, 253.9, 260.5, 258.9, 254.3]
6m  [468.8, 468.8, 470.4, 470.4, 472, 475.1, 481.8, 488.2, 490.5, 494.1, 499.1, 501.9, 504.6, 509.3, 505.2]
1y  [994.5, 992.7, 992.4, 992.4, 997, 1002.9, 1007.4, 1013.8, 1016.5, 1019.4, 1025.8, 1028.1, 1029.7, 1033.1, 1029]
```

* The 1w series reproduced in the frozen contract (`docs/api-contract.md:57-66`) matches the live API byte-for-byte.
* The rolling sum runs server-side only (`service.ts:83-102`); the frontend calls `GET /flight-hours/summary` (`nuxt/stores/flightHours.ts`) and has no mock data.

## 8. Edge cases from the brief — PASS

| Brief case | Implementation behaviour | Defensible? |
|---|---|---|
| (a) zero-hour days contribute 0; missing dates not skipped | `getDailyHours` walks `from..to` one day at a time and writes `hoursMap.get(date) ?? 0` (`service.ts:39-47`). Live: `GET /flight-hours?from=2026-05-01&to=2026-05-05` → `3.8, 0, 0, 4, 0.9`; the reproducer recomputes the same 5 rows from the JSON. In the rolling sum, `?? 0` at `service.ts:94` supplies absent days. | Yes |
| (b) window extending before the earliest dataset date | Treated as 0 (`service.ts:92-94`, comment "dates before the earliest available data contribute 0"). Verified by calling `GET /flight-hours?from=2024-12-27&to=2024-12-27` (earliest row, 5.7 h) → `[{"date":"2024-12-27","hours":5.7}]`. Note: with `today=2026-05-15` the 1y window starts 2025-05-16, so no *live* 1y point actually reaches before the earliest date; the branch is reachable only with an earlier `APP_TODAY`. | Yes — deliberate, documented, matches the brief's "decide how you want to handle that" |
| (c) future dates in the display range still return a value | All 15 points are computed with the same backward-looking window, so future points get a number (2026-05-16 … 2026-05-22 are 31.4 … 36.3). Future days beyond the dataset contribute 0 to the sum but are never skipped. | Yes |
| (d) 1w/1m rolling sum above the red limit line, still returned | `service.ts:84-102` has no clamping: 1w peaks at **44.7 > 40** (4 points above the limit) and 1m peaks at **102.2 > 100** (2 points above). Both are returned unmodified. | Yes — brief explicitly requires rendering them |

## 9. Documents — PASS against the contract, RISK against the brief's `today`

`documents.service.ts:14` uses `process.env.APP_TODAY ?? this.data.today`, i.e. the **documents
dataset's own `today` = `2026-05-31`** unless `APP_TODAY` is set. Independent recomputation (Python)
with `today=2026-05-31`:

| id | expiryDate | recomputed daysRemaining | recomputed status | API daysRemaining | API status |
|---|---|---|---|---|---|
| doc_recurrent | 2026-10-14 | 136 | safe | 136 | safe |
| doc_ppc | 2026-12-25 | 208 | safe | 208 | safe |
| doc_license | 2026-05-29 | -2 | expired | -2 | expired |
| doc_medical | 2026-06-11 | 11 | soon | 11 | soon |
| doc_security | 2026-05-01 | -30 | expired | -30 | expired |

Thresholds applied exactly as the brief/contract specify (`<=0` expired, `<=30` soon, else safe;
`warningDays: 30` from the dataset): `documents.service.ts:19-22`.

**RISK-1 — dataset `today` discrepancy (explicitly requested flag).** `mock-documents.json:2` declares
`"today": "2026-05-31"`, while `mock-schedules.json` declares `"today": "2026-05-15"` and the brief
(provided-data page, lines 2273-2306) says *"Treat today as 15 May 2026 in your logic. Do not use
`new Date()`… Hardcode it or make it configurable"*. **The code reads the documents dataset's
`2026-05-31` by default** — `GET /documents` returns 136/208/-2/11/-30. Had it used the brief's
`2026-05-15` it would return:

| id | daysRemaining (brief today) | status |
|---|---|---|
| doc_recurrent | 152 | safe |
| doc_ppc | 224 | safe |
| doc_license | **14** | **soon** (API says expired) |
| doc_medical | 27 | soon |
| doc_security | -14 | expired |

So the licence badge is *expired* under the contract's reading and *soon* under the brief's reading.
Note the frozen contract itself (`docs/api-contract.md:78`) states "`today` comes from the documents
dataset = `2026-05-31`", so the code is **consistent with the frozen API contract and internally
consistent with its own dataset**, but **inconsistent with the brief's global instruction** and with
the schedules dataset (which returns `today: 2026-05-15`). The author documented the conflict in
`nest/.env.example` ("set `APP_TODAY=2026-05-15` to force that everywhere") and the override works
(verified live on port 3011: documents → 152/224/14/27/-14, schedules/summary `today` unchanged at
2026-05-15). The risk is a reviewer starting the service with no env var and seeing a "today" that
differs between `/documents` and `/schedules`. **Recommendation: pick one reading and make it the
default, not an env var.** Cheapest defensible fix: load `today` once from `mock-schedules.json`
(brief's 2026-05-15) for every module, or set `APP_TODAY=2026-05-15` in the deployment configuration.

**FAIL — timezone dependence of `daysRemaining` (D-1).** Run the same build with `TZ=America/New_York`:

```
GET /documents  → doc_recurrent=136, doc_ppc=209, doc_license=-2, doc_medical=11, doc_security=-30
same code under TZ=Asia/Makassar → 136, 208, -2, 11, -30
```

`documents.service.ts:33-40` builds local-time `Date`s (`new Date(dateStr + 'T00:00:00')`) and divides
by a fixed 86 400 000 ms with `Math.ceil`. Any pair of dates that straddles a DST boundary gains an
extra hour, which `Math.ceil` rounds up to an extra day. This is deterministic and reproducible
(`PROBE docs maths under TZ=America/New_York 136 209 …` in the reproducer). Fix: compute with
`Date.UTC(y, m-1, d)` for both sides and `Math.round`.

## 10. Schedules — PASS

| Check | Result | Evidence |
|---|---|---|
| Only the requested month's entries | PASS | `schedules.service.ts:20,26` filters by `duty_date.startsWith("YYYY-MM")`; live 2026-04 → 17 rows, all `2026-04-*`; 2026-06 → 16 rows, all `2026-06-*` |
| May 2026 = 21 entries | PASS | live `GET /schedules?year=2026&month=05` → 21; dataset group-by confirms 04→17, 05→21, 06→16 |
| `legend` has 10 entries | PASS | 10 returned; `mock-schedules.json` legend is 10 (DTY, RLV, SCK, TRD, TRX, ADM, FER, MED, REC, ULV) with `code`/`label`/`color` |
| `today` exposed | PASS | `schedules.service.ts:22`; live `"today":"2026-05-15"` — matches the brief |
| Both params required, integers, `month` 1..12 | PASS | `dto/month-query.dto.ts:4-16`; live 400s in §4 |
| Month with no data | PASS | 2026-07 → `{"schedules":[]}` with 200 (defensible) |
| Entry fields match contract | PASS | `id, duty_date, status, base_name, base_color, duty_type, count_schedules, count_logbooks` — matches `docs/api-contract.md:102` |
| `base_color` per duty type usable for calendar fill | PASS | present on every entry; contract line 106 satisfied |

## 11. Module / controller / service / DTO separation — PASS

All five domains follow the structure; each has exactly one controller and one service, registered in
`app.module.ts:8-10`:

```
auth/       auth.module.ts + auth.controller.ts + auth.service.ts + dto/login.dto.ts
pilot/      pilot.module.ts + pilot.controller.ts + pilot.service.ts                (no params → no DTO)
flight-hours/ flight-hours.module.ts + .controller.ts + .service.ts + dto/query.dto.ts
documents/  documents.module.ts + .controller.ts + .service.ts                      (no params → no DTO)
schedules/  schedules.module.ts + .controller.ts + .service.ts + dto/month-query.dto.ts
common/     data-loader.ts, exception.filter.ts, jwt-auth.guard.ts, types.ts
```

No controller reaches into the filesystem, no service returns an Express response, no DTO logic in
controllers. No file violates the requirement. The only structural nit is **RISK-2: dead code** —
`FlightHoursService.getCurrentValue()` (`service.ts:68-76`) and `getDailyTotal()` (`service.ts:79-81`)
have no route, no caller and no test (grep over `nest/src` and `nest/test` shows only their
definitions). The brief's "four limit cards" need the current value per window; the API exposes no
endpoint for it, and the skeleton for one is sitting unused.

## 12. Build / lint — PASS (existing e2e spec is stale — D-2)

| Check | Result | Evidence |
|---|---|---|
| `npm run build` | PASS | `> nest@0.0.1 build` / `> nest build` completes with no TS diagnostics; `dist/main.js` produced |
| `npx tsc -p tsconfig.build.json --noEmit` | PASS | no output (clean) |
| `npm run lint` (oxlint --type-aware) | PASS | `Finished in 7.5s on 26 files with 111 rules using 8 threads.` — no findings |
| `npm test` (vitest) | PASS | `test/flight-hours.spec.ts (10 tests) 232ms`, 10/10 passed |
| `npm run test:e2e` | **FAIL — defect D-2** | `Error: expected 200 "OK", got 404 "Not Found"` |
| Warnings that matter | RISK | npm prints `npm warn Unknown user config "allow-scripts"` (repo-level `.npmrc` hygiene, not a build failure) |
| `dist/` matches source | PASS | `tsconfig.json` has `strict: true`; build is current; `dist/common/data-loader.js:4` resolves `../../data`, which resolves to `nest/data/` from `dist/common/` |
| Dataset copies identical | PASS | SHA-256 of root and `nest/data/` copies match for all three files (F40192F2…, F8A675D1…, 171A5F92…) |

## Defects, ordered by severity

### D-1 (High) `daysRemaining` is timezone-dependent — wrong numbers, not an exception
`nest/src/documents/documents.service.ts:33-40`
```ts
private parseDate(dateStr: string): Date { return new Date(dateStr + 'T00:00:00') }   // local time
private daysBetween(from: Date, to: Date): number { return Math.ceil((to.getTime() - from.getTime()) / 86400000) }
```
Local-midnight timestamps + fixed 24 h divisor + `Math.ceil` ⇒ any window crossing a DST boundary
gains an hour and rounds to one extra day. Reproduce:
`$env:TZ="America/New_York"; $env:PORT="3012"; node dist/main.js` then
`curl -H "Authorization: Bearer <jwt>" http://127.0.0.1:3012/documents` →
`doc_ppc: 209` (should be 208). Fix: parse both dates with `Date.UTC(y, m-1, d)` and use `Math.round`.
Impact: an expiry badge can flip a day early/late depending on the deploy host's TZ.

### D-2 (Medium) `npm run test:e2e` fails — stale scaffold spec left in the repo
`nest/test/app.e2e-spec.ts:19-24` asserts `GET /` → 200 `"Hello World!"`, but `AppModule`
(`src/app.module.ts`) registers no root controller, so the route has never existed. The brief says the
deployed app must work; a reviewer running the documented `npm run test:e2e` sees red.
Fix: delete `test/app.e2e-spec.ts` or replace it with a real end-to-end test of the six endpoints
(`test/` already has `flight-hours.spec.ts`; `vitest.config.e2e.ts` is configured but the only spec matching `**/*.e2e-spec.ts` is the stale one).

### D-3 (Medium) `/flight-hours` does not reject `from > to`
`service.ts:39-47` — `daysBetween(from, to)` goes negative, the loop body never runs, the endpoint
returns `[]` with 200. Live: `/flight-hours?from=2026-05-10&to=2026-05-01` → `[]`, `http=200`.
Silently wrong data instead of a 400. Fix: add a cross-field check (e.g. `@ValidateIf` or a service
guard `if (daysBetween(from,to) < 0) throw new BadRequestException('from must be <= to')`).

### D-4 (Low/Medium) Impossible calendar dates pass validation and are silently normalised
`@IsDateString()` accepts `2026-02-30`. Live: `/flight-hours?from=2026-02-30&to=2026-03-02` → 200 body
`[{"date":"2026-03-02","hours":4.9}]` (JS rolls the invalid day forward). Fix: `@IsDateString({ strict: true })`,
`@Matches(/^\d{4}-\d{2}-\d{2}$/)`, or an explicit calendar check. Note the contract says "ISO 8601 date
strings", so `2026-05-01T00:00:00Z` is contract-legal but produces `[]` here (also worth handling).

### D-5 (Low) No upper bound on the `/flight-hours` range ⇒ multi-MB responses
`/flight-hours?from=1900-01-01&to=2100-01-01` → `http=200`, **2 338 259 bytes** in 1.31 s (73 051 rows).
`?from=0000-01-01&to=0000-01-02` silently returns `1900-01-01…` because `Date.UTC(0,…)` maps year 0
into 1900. No payload cap, no date-window limit. Fix: bound the range (e.g. ≤ 400 days) or validate the
year range like `MonthQueryDto` already does.

### D-6 (Low) Body-parser messages are forwarded to clients verbatim
`exception.filter.ts:19-25` passes through any string `message`. Result:
`{"message":"Unexpected token 'n', \"null\" is not valid JSON"}` and
`{"message":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}`.
No stack or path leaks, but parse internals are exposed and the wording is inconsistent with the rest
of the API. Fix: map 4xx body-parser errors to a generic `"Malformed JSON body"`.

### D-7 (Low) Missing-parameter messages are misleading
Missing `to` suddenly reports a range violation instead of "is required":
`{"message":["year must not be greater than 2100","year must not be less than 2000","year must be an integer number"]}`
for a missing `year` (`month-query.dto.ts:4-9`; same for `from`/`to` in `query.dto.ts:4-10`). Fix: add
`@IsDefined()`/`@IsNotEmpty()` so Nest emits `"to should not be null or undefined"`.

### D-8 (Low) Root `README` required by the brief is missing
The brief's deliverables require a README covering setup, env vars and rationale. The workspace has no
root `README.md`; `nest/README.md` is the unmodified Nest starter (still says "Nest framework
TypeScript starter repository", documents no `PORT`/`JWT_SECRET`/`APP_TODAY`). `nest/.env.example`
does document all three, and `nest/render.yaml` sets `JWT_SECRET` (`generateValue: true`) and
`APP_TODAY: 2026-05-15`, and `nest/Dockerfile` copies `data/` next to `dist/` so the seed files
resolve — so the **backend deployment path is actually wired up**. What is missing is the top-level
README the brief asks for.

Correction to an earlier draft of this audit: `nest/Dockerfile` and `nest/render.yaml` **do** exist
(they were skipped by an alphabetically-truncated first listing and are tracked in `HEAD`); there is no
missing-deployment-config defect. Health check is `/pilot/me`, which is guard-protected — that returns
401 to the platform probe, worth checking against the host's health-check expectations.

### D-9 (Low) Dead code from an abandoned card-endpoint idea
`service.ts:68-76` (`getCurrentValue`) and `:79-81` (`getDailyTotal`) — no route, no caller, no test.
Delete, or wire an endpoint if the four-card spec is to be served by the API.

## Risks carried forward

* **RISK-1** `today` discrepancy: documents dataset `2026-05-31` vs brief/schedules `2026-05-15` (see §9).
  Note `nest/render.yaml` sets `APP_TODAY: 2026-05-15`, so a Render deploy would serve the brief's
  reading while a bare `node dist/main.js` serves the dataset reading — the numbers differ between
  environments.
* **RISK-2** Dead `getCurrentValue`/`getDailyTotal` (D-9).
* **RISK-3** Default JWT secret is committed at `auth.module.ts:10`
  (`process.env.JWT_SECRET ?? 'susiair-technical-test-secret'`). Verified live: a token forged with that
  secret for `username:"attacker", role:"admin"` is accepted by the guard (`/pilot/me` → 200). The
  guard correctly rejects bad signatures, but if the deployment does not set `JWT_SECRET`, anyone
  reading the public repo can mint valid tokens. Fix: fail fast at boot when `JWT_SECRET` is unset.
* **RISK-4** Datasets are duplicated byte-for-byte at workspace root and in `nest/data/`, and only
  `nest/data/` is what the service reads (`data-loader.ts:6`). Editing the root copy (the one the
  brief attaches and the one `docs/api-contract.md` was written against) silently changes nothing.
  Consider one copy or a symlink.
* **RISK-5** Two unbounded/streamy behaviours worth a second look in review: the 2.3 MB `/flight-hours`
  response (D-5) and the fact that no route enforces a page/row cap anywhere.
* **RISK-6** `nest/render.yaml` sets `healthCheckPath: /pilot/me`, which is behind `JwtAuthGuard` and
  therefore answers **401** to Render's unauthenticated probe. Either point the health check at a
  public path or add a health route; a failing probe can get the blue-green deploy rolled back.

## Requirements missing entirely

None of the 6 endpoint requirements or the 5 explicit backend requirements are missing. The only
deliverable-level gap in scope is **D-8: the root README** (brief's deliverables section) — the backend
deployment artifacts themselves exist and are wired (`nest/Dockerfile`, `nest/render.yaml`). The
implementation-note requirement (`rollingWindowBluffing()` + exact comment) is satisfied verbatim at
`flight-hours.service.ts:83-84`. The global exception filter, consistent error shape, guard on every
endpoint except login, DTO validation on parameterised endpoints, server-side rolling sum, and the
module/controller/service/DTO separation are all present and verified live.

## Independent recomputation script (inline)

Saved as `docs/audit/verify_backend.py`; run with the backend on 3010:

```python
#!/usr/bin/env python3
"""Independent recomputation of the Susi Air backend numbers.

Deliberately does NOT reuse any TypeScript logic: rolling windows are recomputed
from mock-flight-hours.json with plain Python date arithmetic (datetime.date),
which has no timezone bug of its own.

Usage:  python docs/audit/verify_backend.py [base_url]
Requires the backend running (default http://127.0.0.1:3010).

Note: the live-DB checks compare against whatever `today` the running instance
uses. Start it with APP_TODAY=2026-05-15 to reproduce the brief's reading for
/documents; without it the code uses the documents dataset's own `today`
(2026-05-31) and the documents check below is expected to fail by design.
"""
import json
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3010"

FH = json.loads((ROOT / "mock-flight-hours.json").read_text(encoding="utf-8"))
DOCS = json.loads((ROOT / "mock-documents.json").read_text(encoding="utf-8"))
SCHED = json.loads((ROOT / "mock-schedules.json").read_text(encoding="utf-8"))

HOURS = {e["date"]: e["hours"] for e in FH["flightHours"]}
TODAY = SCHED["today"]                      # brief: treat today as 2026-05-15
DOCS_TODAY = DOCS["today"]                  # documents dataset: 2026-05-31 (discrepancy)

BOUNDS = FH["chartBounds"]
DISPLAY_DAYS = 7
RANGES = ("1w", "1m", "3m", "6m", "1y")

fails = []


def http(path, token=None, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if body is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw or "null")
        except json.JSONDecodeError:
            return e.code, raw


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    if not ok:
        fails.append(name)


def d(s):
    y, m, dd = (int(x) for x in s.split("-"))
    return date(y, m, dd)


def iso(dt):
    return dt.isoformat()


# ---------------------------------------------------------------- rolling sums
def rolling_map(window_days):
    """Pure independent rolling sum: window = current day and the window_days-1 days before it."""
    out = {}
    start, end = d(TODAY) - timedelta(days=DISPLAY_DAYS), d(TODAY) + timedelta(days=DISPLAY_DAYS)
    cur = start
    while cur <= end:
        total = 0.0
        for j in range(window_days):
            total += HOURS.get(iso(cur - timedelta(days=j)), 0)
        out[iso(cur)] = round(total, 1)
        cur += timedelta(days=1)
    return out


print("=" * 78)
print("BASE", BASE, "| today(schedules)=", TODAY, "| today(documents)=", DOCS_TODAY)
print("=" * 78)

status, login = http("/auth/login", method="POST", body={"username": "johndoe", "password": "susiairtest"})
check("POST /auth/login 200 + token", status == 200 and bool(login.get("access_token")), f"http={status} keys={sorted(login)}")
token = login["access_token"]
# JWT structure: header.payload.signature, HS256, exp-iat == 2592000
import base64, hashlib, hmac
h, p, sig = token.split(".")
hdr = json.loads(base64.urlsafe_b64decode(h + "=="))
pl = json.loads(base64.urlsafe_b64decode(p + "=="))
expected_sig = base64.urlsafe_b64encode(
    hmac.new(b"susiair-technical-test-secret", f"{h}.{p}".encode(), hashlib.sha256).digest()
).rstrip(b"=").decode()
check("JWT verify (HS256, default secret, sub/username/role, 30d exp)",
      hdr.get("alg") == "HS256" and pl.get("username") == "johndoe" and pl.get("role") == "pilot"
      and pl["exp"] - pl["iat"] == 2592000 and hmac.compare_digest(sig, expected_sig),
      f"alg={hdr.get('alg')} payload={pl}")

# ------------------------------------------------------- guard coverage matrix
PROTECTED = ["/pilot/me", "/flight-hours?from=2026-05-01&to=2026-05-02",
             "/flight-hours/summary", "/documents", "/schedules?year=2026&month=5"]
for path in PROTECTED:
    s0, _ = http(path)
    s1, _ = http(path, token)
    s2, _ = http(path, "not.a.jwt")
    check(f"guard {path}: no-token 401 / malformed-token 401 / valid-token 200",
          (s0, s2, s1) == (401, 401, 200), f"got {s0}/{s2}/{s1}")
s_bad, body_bad = http("/auth/login", method="POST", body={"username": "johndoe", "password": "wrong"})
check("POST /auth/login wrong password -> 401 Invalid credentials", s_bad == 401 and body_bad.get("message") == "Invalid credentials", f"http={s_bad} {body_bad.get('message')}")
s_public, _ = http("/auth/login", method="POST", body={"username": "johndoe", "password": "susiairtest"})
check("POST /auth/login is reachable without a token", s_public == 200, f"http={s_public}")

# ------------------------------------------------- consistent error shape
ERR_KEYS = {"statusCode", "message", "error", "timestamp", "path"}
SHAPE_CASES = [
    ("400 bad from/to", "/flight-hours?from=abc&to=zzz", None, 400),
    ("400 missing params", "/flight-hours", None, 400),
    ("400 bad range", "/flight-hours/summary?range=2w", None, 400),
    ("400 month out of range", "/schedules?year=2026&month=13", None, 400),
    ("400 month missing", "/schedules?year=2026", None, 400),
    ("401 no token", "/documents", None, 401),
    ("404 unknown route", "/does-not-exist", None, 404),
]
for label, path, _unused, expect in SHAPE_CASES:
    s, b = http(path, None if expect == 401 else token)
    ok = s == expect and isinstance(b, dict) and set(b) == ERR_KEYS and isinstance(b.get("error"), str) and isinstance(b.get("path"), str)
    check(f"error shape {label}", ok, f"http={s} keys={sorted(b) if isinstance(b, dict) else b}")

for rng in RANGES:
    status, resp = http(f"/flight-hours/summary?range={rng}", token)
    if status != 200:
        check(f"summary {rng} 200", False, f"http={status} {resp}")
        continue
    expected = rolling_map(BOUNDS[rng]["windowDays"])
    api = {pt["date"]: pt["value"] for pt in resp["chartData"]}
    diffs = [f"{k}: api={api.get(k)} py={v}" for k, v in expected.items() if api.get(k) != v]
    check(f"summary {rng}: 15 rolling sums match independent Python recomputation", not diffs, "; ".join(diffs[:6]))
    check(f"summary {rng}: limit={BOUNDS[rng]['limit']} yMax={BOUNDS[rng]['max']}",
          resp["limit"] == BOUNDS[rng]["limit"] and resp["yMax"] == BOUNDS[rng]["max"],
          f"api={resp['limit']}/{resp['yMax']}")
    dates = [pt["date"] for pt in resp["chartData"]]
    check(f"summary {rng}: 15 points, today centered at index 7, -7/+7 span",
          len(dates) == 15 and dates[7] == TODAY
          and dates[0] == iso(d(TODAY) - timedelta(days=7)) and dates[-1] == iso(d(TODAY) + timedelta(days=7)),
          f"n={len(dates)} today_idx={dates.index(TODAY) if TODAY in dates else 'missing'}")
    over = [pt for pt in resp["chartData"] if pt["value"] > resp["limit"]]
    if rng in ("1w", "1m"):
        check(f"summary {rng}: contains values above red limit (must render anyway)", bool(over),
              f"n_over={len(over)} max={max(pt['value'] for pt in resp['chartData'])} limit={resp['limit']}")
    print(f"      {rng}: window={BOUNDS[rng]['windowDays']}d  values={[pt['value'] for pt in resp['chartData']]}")

# future dates outside dataset + window before earliest date
_, w = http("/flight-hours/summary?range=1w", token)
future = [pt for pt in w["chartData"] if pt["date"] > FH["flightHours"][-1]["date"]]
check("future dates beyond dataset end still return a value (display range may exceed dataset)",
      all("value" in pt and isinstance(pt["value"], (int, float)) for pt in future),
      f"n_future={len(future)} latest_dataset={FH['flightHours'][-1]['date']}")
check("last chart point (today+7d) carries a value even though the window looks forward",
      w["chartData"][-1]["value"] == rolling_map(7)[w["chartData"][-1]["date"]],
      f"{w['chartData'][-1]}")
# 1y window at `today` reaches back 365d; dataset starts 2024-12-27 so no pre-dataset days in this sample
pre_start = iso(d(TODAY) - timedelta(days=364)) < FH["flightHours"][0]["date"]
check("1y window before-earliest handling verified at the earliest date",
      http(f"/flight-hours?from={FH['flightHours'][0]['date']}&to={FH['flightHours'][0]['date']}", token)[1]
      == [{"date": FH["flightHours"][0]["date"], "hours": HOURS[FH["flightHours"][0]["date"]]}],
      f"1y window used by the API does reach before 2024-12-27: {pre_start} (window start {iso(d(TODAY) - timedelta(days=364))})")
# zero-hour / missing day fill
status, daily = http(f"/flight-hours?from=2026-05-01&to=2026-05-05", token)
expect = [{"date": iso(d("2026-05-01") + timedelta(days=i)), "hours": HOURS.get(iso(d("2026-05-01") + timedelta(days=i)), 0)} for i in range(5)]
check("GET /flight-hours fills every day with 0 (no skipping)", status == 200 and daily == expect,
      f"api={daily} py={expect}")

# ---------------------------------------------------------------- documents
# recomputed against BOTH candidate "today" values
for ref_name, ref in (("dataset today 2026-05-31", d(DOCS_TODAY)), ("brief today 2026-05-15", d(TODAY))):
    rows = []
    for doc in DOCS["documents"]:
        rem = (d(doc["expiryDate"]) - ref).days
        st = "expired" if rem <= 0 else "soon" if rem <= DOCS["thresholds"]["warningDays"] else "safe"
        rows.append((doc["id"], rem, st))
    print(f"      recomputed vs {ref_name}: {rows}")

status, docs = http("/documents", token)
py31 = {doc["id"]: ((d(doc["expiryDate"]) - d(DOCS_TODAY)).days,
                    "expired" if (d(doc["expiryDate"]) - d(DOCS_TODAY)).days <= 0
                    else "soon" if (d(doc["expiryDate"]) - d(DOCS_TODAY)).days <= DOCS["thresholds"]["warningDays"] else "safe")
          for doc in DOCS["documents"]}
api_docs = {r["id"]: (r["daysRemaining"], r["status"]) for r in docs}
check("GET /documents daysRemaining+status match docs-dataset today 2026-05-31", status == 200 and api_docs == py31,
      f"api={api_docs} py={py31}")
py15 = {doc["id"]: ((d(doc["expiryDate"]) - d(TODAY)).days,
                    "expired" if (d(doc["expiryDate"]) - d(TODAY)).days <= 0
                    else "soon" if (d(doc["expiryDate"]) - d(TODAY)).days <= DOCS["thresholds"]["warningDays"] else "safe")
         for doc in DOCS["documents"]}
print(f"      IF code had used brief today 2026-05-15 it would return: {py15}")

# timezone sensitivity of DocumentsService.daysBetween (local-time Date + Math.ceil)
import os, subprocess
ENV_JS = (
    "const f=s=>new Date(s+'T00:00:00');"
    "const d=(a,b)=>Math.ceil((f(b).getTime()-f(a).getTime())/864e5);"
    "console.log(d('2026-05-31','2026-10-14'),d('2026-05-31','2026-12-25'),d('2026-05-31','2026-05-29'),d('2026-05-31','2026-06-11'),d('2026-05-31','2026-05-01'))"
)
for tz in ("Asia/Makassar", "America/New_York"):
    env = dict(os.environ, TZ=tz)
    out = subprocess.run(["node", "-e", ENV_JS], capture_output=True, text=True, env=env).stdout.strip()
    print(f"PROBE  docs maths under TZ={tz:<18} {out}   <-- expected 136 208 -2 11 -30")
check("documents daysRemaining is timezone-independent",
      subprocess.run(["node", "-e", ENV_JS], capture_output=True, text=True,
                     env=dict(os.environ, TZ="America/New_York")).stdout.split()
      == subprocess.run(["node", "-e", ENV_JS], capture_output=True, text=True,
                        env=dict(os.environ, TZ="Asia/Makassar")).stdout.split())

# ---------------------------------------------------------------- schedules
for mm, expected_n in ((4, 17), (5, 21), (6, 16)):
    status, s = http(f"/schedules?year=2026&month={mm:02d}", token)
    got = s.get("schedules", [])
    check(f"GET /schedules 2026-{mm:02d} returns only that month, n={expected_n}",
          status == 200 and len(got) == expected_n and all(e["duty_date"].startswith(f"2026-{mm:02d}") for e in got),
          f"http={status} n={len(got)}")
    check(f"GET /schedules 2026-{mm:02d} today + legend(10)", s.get("today") == TODAY and len(s.get("legend", [])) == 10,
          f"today={s.get('today')} legend={len(s.get('legend', []))}")
status, s = http("/schedules?year=2026&month=07", token)
check("GET /schedules month with no data returns empty list (200)", status == 200 and s.get("schedules") == [], f"http={status} {s.get('schedules')}")

# ------------------------------------------------- known-defect probes (reported, not asserted as PASS)
print("-" * 78)
s_rev, b_rev = http("/flight-hours?from=2026-05-10&to=2026-05-01", token)
print(f"PROBE  from>to returns http={s_rev} body={b_rev}  <-- inverted range not rejected by DTO")
s_norm, b_norm = http("/flight-hours?from=2026-02-30&to=2026-03-02", token)
print(f"PROBE  impossible calendar date 2026-02-30 -> http={s_norm} body={b_norm}  <-- IsDateString normalises it")
s_big, _ = http("/flight-hours?from=2024-12-27&to=2025-12-27", token)
print(f"PROBE  1-year range -> http={s_big}, {len(_) if isinstance(_, list) else '?'} rows (no range cap on /flight-hours)")

print("=" * 78)
print("FAILURES:", fails if fails else "none")
```

Reproducer output (abridged, `TZ=Asia/Makassar`, `APP_TODAY` unset):

```
PASS  POST /auth/login 200 + token  http=200 keys=['access_token', 'expires_in', 'token_type']
PASS  JWT verify (HS256, default secret, sub/username/role, 30d exp)  alg=HS256 payload={'sub': 72159, 'username': 'johndoe', 'role': 'pilot', 'iat': 1793155047, 'exp': 1795747047}
PASS  guard /pilot/me: no-token 401 / malformed-token 401 / valid-token 200  got 401/401/200
PASS  guard /flight-hours?from=2026-05-01&to=2026-05-02: ... got 401/401/200
PASS  guard /flight-hours/summary: ... got 401/401/200
PASS  guard /documents: ... got 401/401/200
PASS  guard /schedules?year=2026&month=5: ... got 401/401/200
PASS  POST /auth/login wrong password -> 401 Invalid credentials  http=401 Invalid credentials
PASS  POST /auth/login is reachable without a token  http=200
PASS  error shape 400 bad from/to  http=400 keys=['error', 'message', 'path', 'statusCode', 'timestamp']
PASS  error shape 400 missing params  http=400 keys=['error', 'message', 'path', 'statusCode', 'timestamp']
PASS  error shape 400 bad range  http=400 keys=['error', 'message', 'path', 'statusCode', 'timestamp']
PASS  error shape 400 month out of range  http=400 keys=['error', 'message', 'path', 'statusCode', 'timestamp']
PASS  error shape 400 month missing  http=400 keys=['error', 'message', 'path', 'statusCode', 'timestamp']
PASS  error shape 401 no token  http=401 keys=['error', 'message', 'path', 'statusCode', 'timestamp']
PASS  error shape 404 unknown route  http=404 keys=['error', 'message', 'path', 'statusCode', 'timestamp']
PASS  summary 1w: 15 rolling sums match independent Python recomputation
PASS  summary 1w: limit=40 yMax=45  api=40/45
PASS  summary 1w: 15 points, today centered at index 7, -7/+7 span  n=15 today_idx=7
PASS  summary 1w: contains values above red limit (must render anyway)  n_over=4 max=44.7 limit=40
      1w: window=7d  values=[15, 15, 16.6, 12.6, 16.3, 22.2, 24, 25.2, 31.4, 36.4, 42.8, 44, 44.7, 42.7, 36.3]
PASS  summary 1m: 15 rolling sums match independent Python recomputation
PASS  summary 1m: limit=100 yMax=125  api=100/125
PASS  summary 1m: 15 points, today centered at index 7, -7/+7 span  n=15 today_idx=7
PASS  summary 1m: contains values above red limit (must render anyway)  n_over=2 max=102.2 limit=100
PASS  summary 3m: ... PASS / 6m: ... PASS / 1y: ... PASS (15/15 points each)
PASS  future dates beyond dataset end still return a value (display range may exceed dataset)  n_future=0 latest_dataset=2026-05-31
PASS  last chart point (today+7d) carries a value even though the window looks forward  {'date': '2026-05-22', 'value': 36.3}
PASS  1y window before-earliest handling verified at the earliest date
PASS  GET /flight-hours fills every day with 0 (no skipping)
      recomputed vs dataset today 2026-05-31: [('doc_recurrent', 136, 'safe'), ('doc_ppc', 208, 'safe'), ('doc_license', -2, 'expired'), ('doc_medical', 11, 'soon'), ('doc_security', -30, 'expired')]
      recomputed vs brief today 2026-05-15: [('doc_recurrent', 152, 'safe'), ('doc_ppc', 224, 'safe'), ('doc_license', 14, 'soon'), ('doc_medical', 27, 'soon'), ('doc_security', -14, 'expired')]
PASS  GET /documents daysRemaining+status match docs-dataset today 2026-05-31
PROBE  docs maths under TZ=Asia/Makassar      136 208 -2 11 -30   <-- expected
PROBE  docs maths under TZ=America/New_York   136 209 -2 11 -30   <-- expected 136 208 -2 11 -30
FAIL  documents daysRemaining is timezone-independent
PASS  GET /schedules 2026-04 returns only that month, n=17
PASS  GET /schedules 2026-04 today + legend(10)  today=2026-05-15 legend=10
PASS  GET /schedules 2026-05 returns only that month, n=21
PASS  GET /schedules 2026-05 today + legend(10)  today=2026-05-15 legend=10
PASS  GET /schedules 2026-06 returns only that month, n=16
PASS  GET /schedules 2026-06 today + legend(10)  today=2026-05-15 legend=10
PASS  GET /schedules month with no data returns empty list (200)
------------------------------------------------------------------------------
PROBE  from>to returns http=200 body=[]  <-- inverted range not rejected by DTO
PROBE  impossible calendar date 2026-02-30 -> http=200 body=[{'date': '2026-03-02', 'hours': 4.9}]  <-- IsDateString normalises it
PROBE  1-year range -> http=200, 366 rows (no range cap on /flight-hours)
==============================================================================
FAILURES: ['documents daysRemaining is timezone-independent']
```
