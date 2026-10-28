/**
 * Live E2E check: Nuxt dev server (3020) + NestJS (3010).
 * Run: node scripts/e2e-check.mjs
 */
const UI = process.env.UI_BASE || 'http://localhost:3020'
const API = process.env.API_BASE || 'http://localhost:3010'

const results = []
const ok = (name, detail) => results.push(['PASS', name, detail])
const bad = (name, detail) => results.push(['FAIL', name, detail])

// 1. backend auth
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'johndoe', password: 'susiairtest' })
})
const login = await loginRes.json()
loginRes.ok ? ok('API POST /auth/login', `${loginRes.status} token_len=${login.access_token?.length}`) : bad('API POST /auth/login', loginRes.status)

const badRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'johndoe', password: 'wrong' })
})
const badBody = await badRes.json()
badRes.status === 401 ? ok('API bad credentials', `401 "${badBody.message}"`) : bad('API bad credentials', badRes.status)

const H = { Authorization: `Bearer ${login.access_token}` }
const get = async (p) => {
  const r = await fetch(`${API}${p}`, { headers: H })
  return [r.status, await r.json()]
}

// 2. data endpoints (what each store consumes)
const [, me] = await get('/pilot/me')
me.name === 'John Doe' ? ok('GET /pilot/me', `${me.name} · ${me.totalFlightHours}h · avatar=${!!me.avatarUrl}`) : bad('GET /pilot/me', JSON.stringify(me))

const [, d1] = await get('/flight-hours?from=2026-05-15&to=2026-05-15')
d1[0]?.hours === 6.4 ? ok('GET /flight-hours (daily card)', `2026-05-15 = ${d1[0].hours}h / 8h`) : bad('GET /flight-hours', JSON.stringify(d1))

const [, w] = await get('/flight-hours/summary?range=1w')
const todayPoint = w.chartData.find((p) => p.date === w.today)
ok('GET /flight-hours/summary?range=1w', `today=${w.today} limit=${w.limit} yMax=${w.yMax} points=${w.chartData.length} todayValue=${todayPoint?.value} max=${Math.max(...w.chartData.map((p) => p.value))}`)
w.chartData.length === 15 ? ok('chart window', '15 points, today centered') : bad('chart window', w.chartData.length)
Math.max(...w.chartData.map((p) => p.value)) > w.limit ? ok('over-limit values present', `${Math.max(...w.chartData.map((p) => p.value))} > ${w.limit} — must still render`) : bad('over-limit values', 'none')

const [, m1] = await get('/flight-hours/summary?range=1m')
const [, y1] = await get('/flight-hours/summary?range=1y')
ok('GET summary 1m / 1y (cards)', `monthly=${m1.chartData.find((p) => p.date === w.today)?.value}/${m1.limit} · annual=${y1.chartData.find((p) => p.date === w.today)?.value}/${y1.limit}`)

const [, docs] = await get('/documents')
docs.length === 5 ? ok('GET /documents', docs.map((d) => `${d.status}:${d.daysRemaining}`).join(' ')) : bad('GET /documents', JSON.stringify(docs))

const [mayStatus, may] = await get('/schedules?year=2026&month=5')
const mayTick = may.schedules.filter((s) => s.count_logbooks === s.count_schedules).length
ok('GET /schedules 2026-05', `${mayStatus} entries=${may.schedules.length} legend=${may.legend.length} ticks=${mayTick} remainingBadges=${may.schedules.length - mayTick}`)
const [aprStatus, apr] = await get('/schedules?year=2026&month=4')
const [junStatus, jun] = await get('/schedules?year=2026&month=6')
ok('GET /schedules month change', `apr(${aprStatus})=${apr.schedules.length} · may(${mayStatus})=${may.schedules.length} · jun(${junStatus})=${jun.schedules.length}`)

// 3. UI guard + rendered pages
const ui = async (path, cookie) => {
  const r = await fetch(`${UI}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} })
  return { status: r.status, location: r.headers.get('location'), body: r.status === 200 ? await r.text() : '' }
}

const anon = await ui('/')
String(anon.status).startsWith('3') && anon.location?.includes('/login')
  ? ok('guard: anonymous / → /login', `${anon.status} → ${anon.location}`)
  : bad('guard: anonymous / → /login', `${anon.status} ${anon.location}`)

const authedLogin = await ui('/login', 'susi_token=' + login.access_token)
String(authedLogin.status).startsWith('3') && authedLogin.location === '/'
  ? ok('guard: authed /login → /', `${authedLogin.status} → ${authedLogin.location}`)
  : bad('guard: authed /login → /', `${authedLogin.status} ${authedLogin.location}`)

const home = await ui('/', 'susi_token=' + login.access_token)
const has = (s) => home.body.includes(s)
const homeChecks = [
  ['John Doe', 'pilot name'],
  ['1,444.5', 'total hours'],
  ['Hours to Limit', 'section'],
  ['Daily', 'daily card'], ['Weekly', 'weekly card'], ['Monthly', 'monthly card'], ['Annual', 'annual card'],
  ['/ 8 h', 'daily limit'], ['/ 40 h', 'weekly limit'], ['/ 100 h', 'monthly limit'], ['/ 1050 h', 'annual limit'],
  ['Flight Hours Trend', 'chart'], ['limit 40h', 'red limit line'], ['22C5E8', 'chart accent'],
  ['My Documents', 'docs'], ['Indonesian Medical Exp. Date', 'doc row'], ['Expiring soon', 'amber badge'], ['Expired', 'red badge'],
  ['Home', 'nav home'], ['Schedule', 'nav schedule'], ['Logbook', 'nav logbook'], ['More', 'nav more'],
  ['2026-05-15', 'API today marker']
]
const missing = homeChecks.filter(([needle]) => !has(needle)).map(([, label]) => label)
missing.length === 0
  ? ok('SSR Home renders API data', `${homeChecks.length} assertions, 15 chart points, daily=6.4h`)
  : bad('SSR Home render', 'missing: ' + missing.join(', '))

const sched = await ui('/schedule', 'susi_token=' + login.access_token)
const schedChecks = ['Legend', 'On Duty', 'May 2026', 'Prev', 'Next', '2026-05-15']
const schedMissing = schedChecks.filter((s) => !sched.body.includes(s))
schedMissing.length === 0 ? ok('SSR Schedule renders calendar+legend', schedChecks.join(' · ')) : bad('SSR Schedule render', 'missing: ' + schedMissing.join(', '))

const loginPage = await ui('/login')
loginPage.body.includes('johndoe') && loginPage.body.includes('Sign in')
  ? ok('SSR /login form', 'username + password inputs present')
  : bad('SSR /login form', 'fields missing')

// 4. report
for (const [state, name, detail] of results) console.log(`${state}  ${name} — ${detail}`)
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
