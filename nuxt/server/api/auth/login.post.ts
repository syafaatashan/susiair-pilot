/**
 * POST /api/auth/login — the ONLY place the JWT is handled.
 * The backend token is stored in an httpOnly cookie and never returned to the
 * browser, so it cannot appear in HTML, SSR payloads, or client JS.
 *
 * Every failure returns the API error envelope
 * { statusCode, message, error, timestamp, path } directly — we never throw
 * createError, so Nitro never serializes the h3 default body (which would leak
 * a stack trace and the "url" field).
 */
import { setResponseStatus } from 'h3'

interface LoginResponse { access_token: string; expires_in?: number }
interface LoginError { response?: { status?: number; _data?: { message?: string | string[] } } }

function errorBody(status: number, message: string, label: string, path: string) {
  return { statusCode: status, message, error: label, timestamp: new Date().toISOString(), path }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event)
  const config = useRuntimeConfig()
  const base = String(config.apiBase || '').replace(/\/$/, '')

  let res: LoginResponse
  try {
    res = await $fetch<LoginResponse>(`${base}/auth/login`, {
      method: 'POST',
      body: { username: body?.username ?? '', password: body?.password ?? '' }
    })
  } catch (e) {
    const err = e as LoginError
    const upstream = err?.response
    const status = Number(upstream?.status || 502)
    const raw = upstream?._data?.message
    const message = Array.isArray(raw) ? raw.join(', ') : raw
    if (status >= 502) {
      setResponseStatus(event, 502)
      return errorBody(502, 'Cannot reach the API. Check your connection and try again.', 'Bad Gateway', event.path)
    }
    setResponseStatus(event, status)
    return errorBody(status, message || 'Invalid credentials', status >= 500 ? 'Upstream Error' : 'Unauthorized', event.path)
  }

  if (!res?.access_token) {
    setResponseStatus(event, 502)
    return errorBody(502, 'Cannot reach the API. Check your connection and try again.', 'Bad Gateway', event.path)
  }

  setCookie(event, 'susi_token', res.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: event.node.req.headers['x-forwarded-proto'] === 'https' || event.context?.requestProtocol === 'https:',
    path: '/',
    maxAge: res.expires_in ?? 60 * 60 * 24 * 30
  })

  // No token in the response body — the client only learns "signed in".
  return { ok: true }
})
