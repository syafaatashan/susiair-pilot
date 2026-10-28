# Susi Air Pilot App — REST API (NestJS)

Backend for the Susi Air Fullstack Developer Technical Test. Six endpoints, JWT auth, JSON
seed data (no database). The full contract with sample payloads lives in
[`../docs/api-contract.md`](../docs/api-contract.md); the repository-wide overview is in
[`../README.md`](../README.md).

## Run

```bash
npm install
npm run build
PORT=3010 node dist/main.js        # PowerShell: $env:PORT="3010"; node dist/main.js
# or with hot reload
PORT=3010 npm run start:dev
```

Port 3000 is only the default — pass `PORT` to use anything else.

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `3000` | HTTP port |
| `JWT_SECRET` | **yes in production** | dev fallback + warning | Token signing secret. The app throws at boot when `NODE_ENV=production` and this is unset. |
| `APP_TODAY` | no | `2026-05-15` | The single "today" reference date used by every endpoint |
| `NODE_ENV` | no | — | Set to `production` on a deployment |

See `.env.example`.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/auth/login` | public — `{ username: "johndoe", password: "susiairtest" }` |
| `GET` | `/pilot/me` | bearer |
| `GET` | `/flight-hours?from=&to=` | bearer |
| `GET` | `/flight-hours/summary?range=1w\|1m\|3m\|6m\|1y` | bearer |
| `GET` | `/documents` | bearer |
| `GET` | `/schedules?year=&month=` | bearer |

Every failure returns one shape:
`{ statusCode, message, error, timestamp, path }`.

## Structure

```
src/
├── main.ts                     # CORS, ValidationPipe, global exception filter
├── app.module.ts
├── common/
│   ├── config.ts               # APP_TODAY, UTC date helpers, MAX_RANGE_DAYS
│   ├── data-loader.ts          # reads ../data/*.json once at boot
│   ├── types.ts                # shared interfaces
│   ├── jwt-auth.guard.ts       # bearer verification
│   ├── exception.filter.ts     # one error shape for the whole API
│   └── is-calendar-date.decorator.ts
├── auth/                       # POST /auth/login (+ LoginDto)
├── pilot/                      # GET /pilot/me
├── flight-hours/               # GET /flight-hours, /flight-hours/summary
├── documents/                  # GET /documents
└── schedules/                  # GET /schedules
data/                           # the three provided JSON seed files (loaded copy)
```

The rolling sum lives in `rollingWindowBluffing()` in
`src/flight-hours/flight-hours.service.ts` — the name and the comment above it are required
verbatim by the brief.

## Tests

```bash
npm test          # 12 unit tests: rolling sum vs an independent reference,
                  # document urgency rules, month filtering, edge cases, UTC safety
npm run test:e2e  # 21 HTTP tests: auth, guard, validation, error envelope
```

## Deploy

`render.yaml` (Render Blueprint) and `Dockerfile` are included. `data/` is copied next to
`dist/` because the loader reads it at boot. Steps: [`../docs/deployment.md`](../docs/deployment.md).