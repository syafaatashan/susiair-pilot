import type { PilotDocument } from '~/types/api'

export const useDocumentsStore = defineStore('documents', () => {
  /** GET /documents. `status` (safe | soon | expired) is rendered as-is — never recomputed. */
  const items = ref<PilotDocument[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      items.value = await useApi().get<PilotDocument[]>('/documents')
      loaded.value = true
    } catch (err) {
      // Empty list, not a fabricated "nothing expiring" state.
      items.value = []
      loaded.value = false
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  function reset() {
    items.value = []
    loaded.value = false
    error.value = null
  }

  return { items, loading, loaded, error, fetchAll, reset }
})
