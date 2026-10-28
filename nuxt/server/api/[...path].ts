/**
 * GET/POST /api/** — same-origin proxy to the NestJS API.
 * The bearer token is read from the httpOnly cookie here on the server; it is
 * never exposed to browser JS. Backend status codes and error bodies pass
 * through unchanged so the client sees the real error envelope.
 *
 * Connection-level failures (backend down / gateway) are converted to a single
 * friendly shape that never leaks the stack, the internal API URL, or the Nuxt
 * "url" field — matching the NestJS API error envelope exactly.
 */
import { setResponseStatus } from 'h3'

const ALLOWED = ['GET', 'POST']

export default defineEventHandler(async (event) => {
  const method = event.method.toUpperCase()
  if (!ALLOWED.includes(method)) {
    setResponseStatus(event, 405)
    return { statusCode: 405, message: `Method ${method} not allowed`, error: 'Method Not Allowed', timestamp: new Date().toISOString(), path: event.path }
  }

  const config = useRuntimeConfig()
  const base = String(config.apiBase || '').replace(/\/$/, '')
  const segments = (getRouterParam(event, 'path') || '').split('/').filter(Boolean)
  const target = `${base}/${segments.join('/')}`
  const query = getQuery(event)
  const queryString = new URLSearchParams(
    Object.entries(query).map(([k, v]) => [k, String(v)])
  ).toString()
  const token = getCookie(event, 'susi_token')
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {})
  }

  try {
    return await proxyRequest(event, queryString ? `${target}?${queryString}` : target, {
      headers,
      fetchOptions: { method: method as 'GET' | 'POST' }
    })
  } catch (err: any) {
    const upstream = err?.response
    const status = Number(upstream?.status || err?.statusCode || err?.status || 502)
    const data = upstream?._data || err?.data || {}
    const raw = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    const isGateway = status >= 502
    const message = isGateway
      ? 'Cannot reach the API. Check your connection and try again.'
      : (raw || err?.statusMessage || data?.error || 'Upstream error')
    const errorLabel = status >= 500 ? 'Upstream Error' : (data?.error || 'Client Error')
    setResponseStatus(event, status)
    return {
      statusCode: status,
      message,
      error: errorLabel,
      timestamp: new Date().toISOString(),
      path: event.path,
    }
  }
})
