import type { Pilot } from '~/types/api'

/**
 * Auth state holds NO token. The JWT lives only in the server-set httpOnly
 * `susi_token` cookie, so it can never be read by browser JS or serialised
 * into the SSR payload.
 */
export const useAuthStore = defineStore('auth', () => {
  const authenticated = ref(false)
  const pilot = ref<Pilot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Server route: validates the httpOnly cookie and returns { authenticated }. */
  async function checkSession() {
    const requestFetch = useRequestFetch()
    try {
      const res = await requestFetch<{ authenticated: boolean }>('/api/auth/session')
      authenticated.value = !!res?.authenticated
    } catch {
      authenticated.value = false
    }
    return authenticated.value
  }

  async function login(username: string, password: string) {
    loading.value = true
    error.value = null
    try {
      // The response carries no token — only { ok: true } and the httpOnly cookie.
      await useApi().post<{ ok: boolean }>('/auth/login', { username, password })
      authenticated.value = true
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    } finally {
      loading.value = false
    }
  }

  function markSignedOut() {
    authenticated.value = false
    pilot.value = null
  }

  /** Clears the httpOnly cookie server-side, then wipes every store. */
  async function signOut() {
    try {
      await useApi().post('/auth/logout')
    } catch {
      // Best effort; local state is reset regardless.
    }
    resetAllStores()
  }

  function resetAllStores() {
    markSignedOut()
    usePilotStore().reset()
    useFlightHoursStore().reset()
    useDocumentsStore().reset()
    useScheduleStore().reset()
    useToastStore().clear()
  }

  return {
    authenticated, pilot, loading, error,
    checkSession, login, markSignedOut, signOut, resetAllStores
  }
})
