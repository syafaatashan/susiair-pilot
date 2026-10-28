import type { Pilot } from '~/types/api'

export const usePilotStore = defineStore('pilot', () => {
  const profile = ref<Pilot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** GET /pilot/me — header greeting, name, total hours, avatar. */
  async function fetchProfile() {
    loading.value = true
    error.value = null
    try {
      profile.value = await useApi().get<Pilot>('/pilot/me')
      // Keep the auth store's copy in sync (it exposes the same profile).
      useAuthStore().pilot = profile.value
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  return { profile, loading, error, fetchProfile }
})
