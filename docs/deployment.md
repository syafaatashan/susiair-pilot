# Deployment guide

Two deployments are required by the brief: a live **API** and a live **web app** that talks
to it. This guide is written for **Render** (API) + **Vercel** (web app) — both have free
tiers and need no credit card. Alternatives are noted at the end.

Everything below assumes the repository root already contains `nest/` and `nuxt/`.

---

## 0. Push the repository to GitHub

```bash
cd "E:\Deeseek-Harness\Susi Air"
git add -A
git commit -m "docs: README, deployment guide, submission notes"
git branch -M main

# create an empty repo on github.com first, then:
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

> The repository must contain **both folders**. `node_modules/`, `dist/`, `.nuxt/` and
> `.output/` are already in `.gitignore`, so the push stays small.

---

## 1. API → Render

### Option A — Blueprint (uses `nest/render.yaml`, ~2 minutes)

1. Render dashboard → **New** → **Blueprint**.
2. Pick the repository. Render finds `nest/render.yaml` and proposes a service named
   `susiair-pilot-api`.
3. Apply. Render:
   - installs with `npm ci && npm run build` inside `nest/`
   - starts with `node dist/main.js`
   - generates `JWT_SECRET`
   - injects `PORT` automatically (the app reads `process.env.PORT`)

### Option B — manual web service

1. **New** → **Web Service** → pick the repository.
2. **Root Directory:** `nest`
3. **Runtime:** Node
4. **Build Command:** `npm ci && npm run build`
5. **Start Command:** `node dist/main.js`
6. **Environment variables:**

   | Key | Value |
   | --- | --- |
   | `NODE_VERSION` | `24` |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | a long random string (Render can generate one) — **required** |

   The API refuses to boot when `NODE_ENV=production` and `JWT_SECRET` is missing, because
   the repository contains a public development fallback secret that would let anyone forge
   a token.

   Do **not** set `APP_TODAY` — the application default (`2026-05-15`, the brief's date) is
   what the submission is reviewed against.
7. Deploy. Note the URL, e.g. `https://susiair-pilot-api.onrender.com`.

### Smoke-test the API

```bash
API=https://susiair-pilot-api.onrender.com

# 1. login
curl -s -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"username":"johndoe","password":"susiairtest"}'

# 2. authorised call (paste the access_token from above)
curl -s $API/pilot/me -H "Authorization: Bearer <token>"

# 3. guard must reject this
curl -s -o /dev/null -w "%{http_code}\n" $API/pilot/me      # → 401
```

Free Render instances sleep after ~15 minutes idle; the first request afterwards can take
30–60 s. Open the API URL once before reviewing the frontend.

---

## 2. Web app → Vercel

1. Vercel dashboard → **Add New** → **Project** → import the same repository.
2. **Root Directory:** `nuxt` (Vercel detects Nuxt automatically).
3. Framework preset: **Nuxt** (auto-detected). Leave build/install commands at their
   defaults (`npm install`, `npm run build`).
4. **Environment variable:**

   | Key | Value |
   | --- | --- |
   | `NUXT_API_BASE` | the Render URL from step 1, no trailing slash |

5. Deploy and note the URL, e.g. `https://susiair-pilot.vercel.app`.

CORS needs no configuration: `nest/src/main.ts` enables it with `origin: true`.

The web app talks to the API through its own Nitro server routes (`nuxt/server/api/...`),
which attach the bearer token from an `httpOnly` cookie. The token is therefore never
present in the HTML, in the browser's JavaScript, or in a CDN cache — which also means the
deployed web app works even if the API's CORS policy were tightened later.

### Smoke-test the deployed web app

1. Open the Vercel URL in a mobile-sized viewport. You should be redirected to `/login`.
2. Sign in with `johndoe` / `susiairtest`.
3. Home shows **John Doe**, **1,444.5 h**, four limit cards, the chart, five documents and
   the bottom navigation.
4. Switch the chart toggle through 1w → 1m → 3m → 6m → 1y; the axis maximum and the red
   limit line must change with it.
5. Open Schedule, then press Prev/Next a few times — April 2026 has 17 entries, May 21,
   June 16.
6. Refresh the page while signed in: the guard must keep you signed in (the token is in a
   cookie).

If the app renders but every panel is empty, `NUXT_API_BASE` is wrong or the API is
asleep — check the browser network tab for the failing request.

---

## 3. Alternatives

**Netlify instead of Vercel** (web app): site settings → build command `npm run build`,
publish directory `nuxt/.output/public`, and the same `NUXT_API_BASE` variable.
Nuxt's Nitro server build needs the Node runtime, so use **Vercel** or Netlify's Next/Nuxt
runtime rather than a plain static publish if you want SSR.

**Railway / Fly.io instead of Render** (API): both build from the included
`nest/Dockerfile`:

- Railway: New Project → Deploy from repo → set **Root Directory** to `nest`; Railway
  detects the Dockerfile. Add `JWT_SECRET` and set `NODE_ENV=production`.
- Fly.io: `cd nest && fly launch --dockerfile Dockerfile`, then
  `fly secrets set JWT_SECRET=...`, set `NODE_ENV=production`, then `fly deploy`.

The Dockerfile copies `data/` next to `dist/`, which the JSON loader needs at boot.

---

## 4. Checklist before pressing "Submit test"

- [ ] API URL responds to `POST /auth/login` with a token
- [ ] `/pilot/me` without a token returns 401 (the guard is live)
- [ ] Web app URL loads and redirects to `/login` when signed out
- [ ] Login works end-to-end against the **deployed** API (not localhost)
- [ ] All five chart ranges render without layout breaks
- [ ] Schedule Prev/Next fetches new months
- [ ] Documents show green/amber/red badges
- [ ] Both URLs are in the submission PDF
- [ ] No further commits pushed after submitting (the brief reviews the repo as it stands)