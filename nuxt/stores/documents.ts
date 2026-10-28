import type { PilotDocument } from '~/types/api'

export const useDocumentsStore = defineStore('documents', () => {
  /** GET /documents. `status` (safe | soon | expired) is rendered as-is — never recomputed. */
  const items = ref<PilotDocument[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      items.value = await useApi().get<PilotDocument[]>('/documents')
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, fetchAll }
})
