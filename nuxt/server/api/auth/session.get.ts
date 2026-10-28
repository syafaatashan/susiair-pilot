/**
 * GET /api/auth/session — tells the client only whether the httpOnly cookie is
 * backed by a working token. The token itself is never returned.
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'susi_token')
  if (!token) return { authenticated: false }

  const config = useRuntimeConfig()
  const base = String(config.apiBase || '').replace(/\/$/, '')
  try {
    await $fetch(`${base}/pilot/me`, { headers: { Authorization: `Bearer ${token}` } })
    return { authenticated: true }
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 403) {
      deleteCookie(event, 'susi_token', { path: '/' })
      return { authenticated: false }
    }
    // API down / unknown: keep the cookie, do not claim the session is invalid.
    return { authenticated: true, degraded: true }
  }
})
