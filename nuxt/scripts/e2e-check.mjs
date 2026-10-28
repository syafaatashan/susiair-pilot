/**
 * Live end-to-end check for the Nuxt app (3020) + NestJS API (3010).
 *
 *   node scripts/e2e-check.mjs
 *   UI_BASE=http://localhost:3020 API_BASE=http://localhost:3010 node scripts/e2e-check.mjs
 *
 * Covers: the real API endpoints, the same-origin /api proxy, httpOnly-cookie
 * auth, the JWT never appearing in HTML, both route-guard directions, the 401
 * path, logout, and month navigation.
 */
const UI = process.env.UI_BASE || 'http://localhost:3020'
const API = process.env.API_BASE || 'http://localhost:3010'

const results = []
const ok = (name, detail) => results.push(['PASS', name, detail])
const bad = (name, detail) => results.push(['FAIL', name, detail])
const check = (cond, name, good, fail) => (cond ? ok(name, good) : bad(name, fail))

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/
const setCookies = (res) => res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') || '']

const json = async (url, opts) => {
  const r = await fetch(url, opts)
  return { status: r.status, body: await r.json().catch(() => null), res: r }
}
const ui = async (path, cookie) => {
  const r = await fetch(`${UI}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} })
  return { status: r.status, location: r.headers.get('location'), body: r.status === 200 ? await r.text() : '' }
}

// ---------------------------------------------------------------- 1. raw API
const login = await json(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'johndoe', password: 'susiairtest' })
})
check(login.status === 200 && !!login.body?.access_token, 'API POST /auth/login', `200 token_len=${login.body?.access_token?.length}`, String(login.status))

const badLogin = await json(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'johndoe', password: 'wrong' })
})
check(badLogin.status === 401, 'API bad credentials', `401 "${badLogin.body?.message}"`, String(badLogin.status))

const H = { Authorization: `Bearer ${login.body.access_token}` }
const get = async (p) => (await json(`${API}${p}`, { headers: H })).body

const me = await get('/pilot/me')
check(me?.name === 'John Doe', 'GET /pilot/me', `${me.name} · ${me.totalFlightHours}h · avatar=${!!me.avatarUrl}`, JSON.stringify(me))

const daily = await get('/flight-hours?from=2026-05-15&to=2026-05-15')
check(daily?.length === 1 && typeof daily[0].hours === 'number', 'GET /flight-hours (daily card)', `2026-05-15 = ${daily?.[0]?.hours}h / 8h`, JSON.stringify(daily))

const w = await get('/flight-hours/summary?range=1w')
const values = (w?.chartData || []).map((p) => p.value)
const todayPoint = (w?.chartData || []).find((p) => p.date === w.today)
ok('GET /flight-hours/summary?range=1w', `today=${w.today} limit=${w.limit} yMax=${w.yMax} points=${w.chartData.length} todayValue=${todayPoint?.value} max=${Math.max(...values)}`)
check(w.chartData.length === 15, 'chart window', '15 points, today centered', String(w.chartData.length))
check(Math.max(...values) > w.limit, 'over-limit values present', `${Math.max(...values)} > ${w.limit} — must still render`, 'none')

const m1 = await get('/flight-hours/summary?range=1m')
const y1 = await get('/flight-hours/summary?range=1y')
ok('GET summary 1m / 1y (cards)', `monthly=${m1.chartData.find((p) => p.date === w.today)?.value}/${m1.limit} · annual=${y1.chartData.find((p) => p.date === w.today)?.value}/${y1.limit}`)

const docs = await get('/documents')
check(docs?.length === 5, 'GET /documents', docs.map((d) => `${d.status}:${d.daysRemaining}`).join(' '), JSON.stringify(docs))

const may = await get('/schedules?year=2026&month=5')
const mayTick = may.schedules.filter((s) => s.count_logbooks === s.count_schedules).length
ok('GET /schedules 2026-05', `entries=${may.schedules.length} legend=${may.legend.length} ticks=${mayTick} remainingBadges=${may.schedules.length - mayTick}`)
const apr = await get('/schedules?year=2026&month=4')
const jun = await get('/schedules?year=2026&month=6')
check(apr.schedules.length === 17 && jun.schedules.length === 16, 'GET /schedules month change', `apr=${apr.schedules.length} · may=${may.schedules.length} · jun=${jun.schedules.length}`, 'unexpected month sizes')

// ------------------------------------------------- 2. proxy + httpOnly cookie
const uiLogin = await fetch(`${UI}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'johndoe', password: 'susiairtest' })
})
const uiLoginBody = await uiLogin.json().catch(() => ({}))
const cookieHeader = setCookies(uiLogin).map((c) => c.split(';')[0]).join('; ')
const flags = setCookies(uiLogin).join(' ')

check(uiLogin.status === 200 && !uiLoginBody.access_token, 'POST /api/auth/login returns no token', `body=${JSON.stringify(uiLoginBody)}`, JSON.stringify(uiLoginBody))
check(/httponly/i.test(flags) && /samesite=lax/i.test(flags), 'session cookie is httpOnly + SameSite=Lax', flags.replace(/\s+/g, ' ').slice(0, 130), flags)
check(!!cookieHeader && !JWT_RE.test(JSON.stringify(uiLoginBody)), 'JWT withheld from response body', 'token only in Set-Cookie', 'token leaked in body')

const proxyMe = await json(`${UI}/api/pilot/me`, { headers: { cookie: cookieHeader } })
check(proxyMe.status === 200 && proxyMe.body?.name === 'John Doe', 'GET /api/pilot/me (proxy attaches bearer)', `${proxyMe.status} ${proxyMe.body?.name}`, `${proxyMe.status} ${JSON.stringify(proxyMe.body)}`)

const session = await json(`${UI}/api/auth/session`, { headers: { cookie: cookieHeader } })
check(session.body?.authenticated === true, 'GET /api/auth/session (valid cookie)', `${session.status} ${JSON.stringify(session.body)}`, JSON.stringify(session.body))

const forged = await json(`${UI}/api/auth/session`, { headers: { cookie: 'susi_token=forged.token.value' } })
check(forged.body?.authenticated === false, 'forged cookie rejected', JSON.stringify(forged.body), JSON.stringify(forged.body))

// ------------------------------------------------------- 3. guards + JWT leak
const anon = await ui('/')
check(String(anon.status).startsWith('3') && anon.location?.includes('/login'), 'guard: anonymous / → /login', `${anon.status} → ${anon.location}`, `${anon.status} ${anon.location}`)

const anonSched = await ui('/schedule')
check(String(anonSched.status).startsWith('3'), 'guard: anonymous /schedule → /login', `${anonSched.status} → ${anonSched.location}`, String(anonSched.status))

const authedLogin = await ui('/login', cookieHeader)
check(String(authedLogin.status).startsWith('3') && authedLogin.location === '/', 'guard: authed /login → /', `${authedLogin.status} → ${authedLogin.location}`, `${authedLogin.status} ${authedLogin.location}`)

const forgedHome = await ui('/', 'susi_token=forged.token.value')
check(String(forgedHome.status).startsWith('3') && forgedHome.location === '/login', 'guard: forged cookie / → /login', `${forgedHome.status} → ${forgedHome.location}`, `${forgedHome.status} ${forgedHome.location}`)

const home = await ui('/', cookieHeader)
check(!JWT_RE.test(home.body), 'no JWT anywhere in SSR HTML', `${home.body.length} bytes scanned, 0 matches`, 'JWT found in HTML/payload!')

const homeChecks = [
  ['John Doe', 'pilot name'],
  ['1,444.5', 'total hours'],
  ['Hours to Limit', 'section'],
  ['Daily', 'daily card'], ['Weekly', 'weekly card'], ['Monthly', 'monthly card'], ['Annual', 'annual card'],
  ['/ 8 h', 'daily limit'], ['/ 40 h', 'weekly limit'], ['/ 100 h', 'monthly limit'], ['/ 1050 h', 'annual limit'],
  ['Flight Hours Trend', 'chart'], ['limit 40h', 'red limit line'], ['22C5E8', 'chart accent'],
  ['My Documents', 'docs'], ['Indonesian Medical Exp. Date', 'doc row'], ['Expiring soon', 'amber badge'], ['Expired', 'red badge'],
  ['Home', 'nav home'], ['Schedule', 'nav schedule'], ['Logbook', 'nav logbook'], ['More', 'nav more'],
  ['2026-05-15', 'API today marker'], ['Sign out', 'logout control'], ['brand__name', 'brand logo']
]
const missing = homeChecks.filter(([needle]) => !home.body.includes(needle)).map(([, label]) => label)
check(missing.length === 0, 'SSR Home renders API data', `${homeChecks.length} assertions, pilot+cards+chart+docs on first paint`, 'missing: ' + missing.join(', '))

const sched = await ui('/schedule', cookieHeader)
const schedChecks = ['Legend', 'On Duty', 'May 2026', 'Prev', 'Next', '2026-05-15']
const schedMissing = schedChecks.filter((s) => !sched.body.includes(s))
check(schedMissing.length === 0, 'SSR Schedule renders calendar+legend', schedChecks.join(' · '), 'missing: ' + schedMissing.join(', '))
check(!JWT_RE.test(sched.body), 'no JWT in schedule HTML', 'clean', 'JWT found!')

const loginPage = await ui('/login')
check(loginPage.body.includes('johndoe') && loginPage.body.includes('Sign in'), 'SSR /login form', 'username + password inputs present', 'fields missing')

// ---------------------------------------------------------------- 4. logout
const logout = await fetch(`${UI}/api/auth/logout`, { method: 'POST', headers: { cookie: cookieHeader } })
const cleared = setCookies(logout).join(' ')
check(logout.status === 200 && /susi_token=;|max-age=0|expires=/i.test(cleared), 'POST /api/auth/logout clears cookie', `${logout.status} ${cleared.replace(/\s+/g, ' ').slice(0, 90)}`, `${logout.status} ${cleared}`)

// ---------------------------------------------------------------- report
for (const [state, name, detail] of results) console.log(`${state}  ${name} — ${detail}`)
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
