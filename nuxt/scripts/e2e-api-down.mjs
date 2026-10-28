/**
 * API-down check (F-4): start the app against an unreachable API and confirm no
 * internal URL leaks and no fabricated numbers render.
 *
 *   PORT=3021 NUXT_API_BASE=http://localhost:3011 node .output/server/index.mjs
 *   node scripts/e2e-api-down.mjs
 *
 * A real httpOnly cookie is minted first against the healthy backend, so the
 * guard lets the request through and the failure happens at the data layer.
 */
const UI = process.env.UI_BASE || 'http://localhost:3021'
const API = process.env.API_BASE || 'http://localhost:3010'

const results = []
const ok = (name, detail) => results.push(['PASS', name, detail])
const bad = (name, detail) => results.push(['FAIL', name, detail])

// Mint a valid session cookie against the real backend.
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'johndoe', password: 'susiairtest' })
})
const token = (await login.json()).access_token
const cookie = `susi_token=${token}`

const home = await fetch(`${UI}/`, { headers: { cookie } })
const html = await home.text()

// Friendly message, no internal URL, no fabricated data.
const hasFriendly = html.includes('Cannot reach the API')
const leaksUrl = /localhost:3\d{3}|127\.0\.0\.1:3\d{3}/.test(html)
const hasFetchNoise = /Failed to fetch|\[GET\]|\[POST\]/.test(html)
const hasPlaceholder = html.includes('1,444.5')
const hasZeroHours = />0\.0</.test(html)
const hasErrorState = html.includes('Flight hours unavailable') || html.includes('Documents unavailable')

hasFriendly ? ok('friendly API-down message rendered', 'Cannot reach the API…') : bad('friendly API-down message', 'not found in HTML')
!leaksUrl ? ok('internal API URL not leaked', 'no localhost:3010/:3011 in HTML') : bad('internal API URL leaked', 'found localhost:3xxx in HTML')
!hasFetchNoise ? ok('no raw ofetch error text', 'no "Failed to fetch" / "[GET]"') : bad('raw ofetch error text present', 'Failed to fetch / [GET] found')
!hasPlaceholder ? ok('pilot profile not fabricated', 'total hours not shown as 1,444.5') : bad('fabricated profile', '1,444.5 rendered while API is down')
!hasZeroHours ? ok('no fabricated 0.0 card values', 'cards hidden on load failure') : bad('fabricated zero values', '0.0 rendered')
hasErrorState ? ok('empty/error state shown for data sections', 'error state markup present') : bad('missing error state', 'no error state markup')

for (const [state, name, detail] of results) console.log(`${state}  ${name} — ${detail}`)
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
