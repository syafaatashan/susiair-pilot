import type { FetchError } from 'ofetch'

export interface ApiErrorShape {
  statusCode: number
  message: string | string[]
  error?: string
}

/**
 * Single entry point for every backend call.
 * - base URL from runtime config (NUXT_PUBLIC_API_BASE)
 * - attaches the bearer token from the auth store
 * - normalises the backend error envelope into a readable string
 *   ({ statusCode, message, error, timestamp, path }) and never swallows it
 */
export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  function messageOf(err: unknown): string {
    const e = err as FetchError<ApiErrorShape>
    const status = e?.response?.status ?? 0
    const raw = (e?.data as ApiErrorShape | undefined)?.message
    const text = Array.isArray(raw) ? raw.join(', ') : raw
    if (text) return status ? `${text} (${status})` : text
    if (status === 401) return 'Your session expired. Please sign in again. (401)'
    if (status) return `Request failed (${status})`
    return e?.message || 'Network error — cannot reach the API.'
  }

  function pushError(err: unknown) {
    const msg = messageOf(err)
    const status = (err as FetchError)?.response?.status
    useToastStore().show(msg, 'error')
    if (status === 401 && auth.token) auth.signOut()
    return msg
  }

  async function request<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
    const base = String(config.public.apiBase || '').replace(/\/$/, '')
    try {
      return await $fetch<T>(`${base}${path}`, {
        ...opts,
        headers: {
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
          ...((opts.headers as Record<string, string>) || {})
        }
      })
    } catch (err) {
      throw new Error(pushError(err))
    }
  }

  return {
    /** GET a path, appending query params when provided. */
    get: <T>(path: string, query?: Record<string, string | number>) =>
      request<T>(path, query ? { query } : {}),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
    messageOf,
    pushError
  }
}
