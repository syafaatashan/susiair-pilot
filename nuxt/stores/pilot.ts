import type { Pilot } from '~/types/api'

export const usePilotStore = defineStore('pilot', () => {
  const profile = ref<Pilot | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  /** GET /pilot/me — header greeting, name, total hours, avatar. */
  async function fetchProfile() {
    loading.value = true
    error.value = null
    try {
      profile.value = await useApi().get<Pilot>('/pilot/me')
      loaded.value = true
    } catch (err) {
      // Stay null: the header must never show fabricated numbers.
      error.value = (err as Error).message
      loaded.value = false
    } finally {
      loading.value = false
    }
  }

  function reset() {
    profile.value = null
    loaded.value = false
    error.value = null
  }

  return { profile, loading, loaded, error, fetchProfile, reset }
})
