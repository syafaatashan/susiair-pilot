# Susi Air Pilot App — API Contract (frozen)

Backend: NestJS, base URL local `http://localhost:3010` (dev). No global prefix.
All endpoints except `POST /auth/login` require header `Authorization: Bearer <token>`.

## Error shape (global exception filter, every failure)

```json
{
  "statusCode": 401,
  "message": "No bearer token provided",
  "error": "Unauthorized",
  "timestamp": "2026-10-28T02:29:55.780Z",
  "path": "/pilot/me"
}
```
`message` is a string, or an array of strings for validation errors.

## 1. POST /auth/login

Request `{"username":"johndoe","password":"susiairtest"}`

200:
```json
{"access_token":"<jwt>","token_type":"Bearer","expires_in":2592000}
```
401 on bad credentials: `{"statusCode":401,"message":"Invalid credentials",...}`

## 2. GET /pilot/me

200:
```json
{"name":"John Doe","totalFlightHours":1444.5,"avatarUrl":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=128&h=128&q=80"}
```

## 3. GET /flight-hours?from=YYYY-MM-DD&to=YYYY-MM-DD

Both params required, ISO 8601 date strings. Returns **every day in the range**
(missing days filled with `hours: 0`).

200:
```json
[{"date":"2026-05-01","hours":3.8},{"date":"2026-05-02","hours":0},{"date":"2026-05-03","hours":0},{"date":"2026-05-04","hours":4},{"date":"2026-05-05","hours":0.9}]
```

## 4. GET /flight-hours/summary?range=1w|1m|3m|6m|1y

`range` optional, default `1w`. Invalid value → 400.

200 (`range=1w`):
```json
{
  "today": "2026-05-15",
  "range": "1w",
  "limit": 40,
  "yMax": 45,
  "chartData": [
    {"date":"2026-05-08","value":15},   {"date":"2026-05-09","value":15},
    {"date":"2026-05-10","value":16.6}, {"date":"2026-05-11","value":12.6},
    {"date":"2026-05-12","value":16.3}, {"date":"2026-05-13","value":22.2},
    {"date":"2026-05-14","value":24},   {"date":"2026-05-15","value":25.2},
    {"date":"2026-05-16","value":31.4}, {"date":"2026-05-17","value":36.4},
    {"date":"2026-05-18","value":42.8}, {"date":"2026-05-19","value":44},
    {"date":"2026-05-20","value":44.7}, {"date":"2026-05-21","value":42.7},
    {"date":"2026-05-22","value":36.3}
  ]
}
```
- `chartData` is always 15 points: 7 days before `today`, `today`, 7 days after.
- `value` is the rolling sum over the selected window (7/30/90/180/365 days) ending that day.
- `limit` = red horizontal line; `yMax` = chart Y maximum.
- Values may exceed `limit` (e.g. 44.7 > 40) — chart must render without breaking layout.

Per-range bounds (`limit` / `yMax`): 1w 40/45 · 1m 100/125 · 3m 300/325 · 6m 600/625 · 1y 1050/1200.

## 5. GET /documents

200 (array; `today` comes from the documents dataset = `2026-05-31`):
```json
[
 {"id":"doc_recurrent","label":"Next Recurrent Date","expiryDate":"2026-10-14","daysRemaining":136,"status":"safe"},
 {"id":"doc_ppc","label":"PPC Exp. Date","expiryDate":"2026-12-25","daysRemaining":208,"status":"safe"},
 {"id":"doc_license","label":"Indonesian License Exp. Date","expiryDate":"2026-05-29","daysRemaining":-2,"status":"expired"},
 {"id":"doc_medical","label":"Indonesian Medical Exp. Date","expiryDate":"2026-06-11","daysRemaining":11,"status":"soon"},
 {"id":"doc_security","label":"Security Clearance Exp. Date","expiryDate":"2026-05-01","daysRemaining":-30,"status":"expired"}
]
```
`status`: `expired` when daysRemaining <= 0 · `soon` when <= 30 · else `safe`. Badge state comes from the API — no client-side calculation.

## 6. GET /schedules?year=YYYY&month=MM

Both required, integers (`month` 1..12, invalid → 400). Returns only entries in that month.

200:
```json
{
  "today": "2026-05-15",
  "year": 2026,
  "month": 5,
  "legend": [{"code":"DTY","label":"On Duty","color":"#10B981"}, "... 10 entries total"],
  "schedules": [
    {"id":"97020","duty_date":"2026-05-03","status":2,"base_name":"MKW","base_color":"#10B981","duty_type":"DTY","count_schedules":4,"count_logbooks":4}
  ]
}
```
- Day cell fill colour = `base_color` from the API.
- Badge: tick when `count_logbooks === count_schedules`, else the number of **remaining** duties (`count_schedules - count_logbooks`).
- `today` marks the current day on the calendar.
- May 2026 returns 21 entries; April 2026 and June 2026 are also in the dataset.
