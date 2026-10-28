import type { LoginResponse, Pilot } from '~/types/api'

const TOKEN_COOKIE = 'susi_token'

export const useAuthStore = defineStore('auth', () => {
  // Cookie (not localStorage) so route middleware can read it on the server too.
  const tokenCookie = useCookie<string | null>(TOKEN_COOKIE, {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/'
  })

  const token = ref<string | null>(tokenCookie.value ?? null)
  const pilot = ref<Pilot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)

  function setToken(value: string | null) {
    token.value = value
    tokenCookie.value = value
  }

  function signOut() {
    setToken(null)
    pilot.value = null
    const schedule = useScheduleStore()
    schedule.reset()
  }

  async function login(username: string, password: string) {
    loading.value = true
    error.value = null
    try {
      // Raw $fetch: the login response is the only shape that is not the standard
      // error-then-throw path we want for the form (form renders `error` inline).
      const config = useRuntimeConfig()
      const base = String(config.public.apiBase || '').replace(/\/$/, '')
      const res = await $fetch<LoginResponse>(`${base}/auth/login`, {
        method: 'POST',
        body: { username, password }
      })
      setToken(res.access_token)
      return true
    } catch (err) {
      error.value = useApi().messageOf(err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchPilot() {
    if (!token.value) return
    loading.value = true
    try {
      pilot.value = await useApi().get<Pilot>('/pilot/me')
    } finally {
      loading.value = false
    }
  }

  return { token, pilot, loading, error, isAuthenticated, login, fetchPilot, signOut, setToken }
})
