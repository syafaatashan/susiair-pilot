export interface ApiErrorShape {
  statusCode: number
  message: string | string[]
  error?: string
}

const NETWORK_ERROR = 'Cannot reach the API. Check your connection and try again.'

function messageOf(status: number, raw: unknown): string {
  const text = Array.isArray(raw) ? raw.join(', ') : (raw as string | undefined)
  // 502/503/504 come from Nitro's proxy when the backend is unreachable or
  // booting — surface the friendly message, not a bare gateway status.
  if (status >= 502) return NETWORK_ERROR
  if (text && status !== 502) return status ? `${text} (${status})` : text
  if (status === 401) return 'Your session expired. Please sign in again. (401)'
  if (status) return `Request failed (${status})`
  return NETWORK_ERROR
}

/**
 * Single entry point for every backend call.
 * Requests go to same-origin `/api/**` (Nitro proxy); the JWT lives in an
 * httpOnly cookie and is attached server-side, so it never reaches this code.
 * Errors are normalised to friendly text (never the raw ofetch URL string).
 */
export function useApi() {
  const requestFetch = useRequestFetch()
  const auth = useAuthStore()

  function pushError(err: unknown): string {
    const e = err as {
      statusCode?: number
      status?: number
      data?: ApiErrorShape & { statusMessage?: string }
      response?: { status?: number; _data?: ApiErrorShape }
    }
    const status = e?.statusCode ?? e?.status ?? e?.response?.status ?? 0
    const payload = e?.data ?? e?.response?._data
    const msg = messageOf(status, payload?.message)
    useToastStore().show(msg, 'error')

    if (status === 401) {
      auth.markSignedOut()
      // Client-side bounce, so a forged or expired session never lands on a zeroed page.
      if (import.meta.client) {
        const router = useRouter()
        if (router.currentRoute.value.path !== '/login') router.push('/login')
      }
    }
    return msg
  }

  async function request<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
    try {
      return await requestFetch<T>(`/api${path}`, opts)
    } catch (err) {
      throw new Error(pushError(err))
    }
  }

  function queryString(query: Record<string, string | number>) {
    return new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
  }

  return {
    /** GET a path, appending query params when provided. */
    get: <T>(path: string, query?: Record<string, string | number>) =>
      request<T>(query ? `${path}?${queryString(query)}` : path),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    pushError
  }
}
