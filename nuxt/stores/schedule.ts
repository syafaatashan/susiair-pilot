import type { MonthSchedules, ScheduleEntry } from '~/types/api'

export const useScheduleStore = defineStore('schedule', () => {
  const year = ref(2026)
  const month = ref(5) // May 2026 — the dataset month; `today` still comes from the API.
  const data = ref<MonthSchedules | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const entries = computed<ScheduleEntry[]>(() => data.value?.schedules ?? [])
  const legend = computed(() => data.value?.legend ?? [])
  const today = computed(() => data.value?.today ?? '')

  async function fetchMonth(y = year.value, m = month.value) {
    year.value = y
    month.value = m
    loading.value = true
    error.value = null
    try {
      data.value = await useApi().get<MonthSchedules>('/schedules', { year: y, month: m })
    } catch (err) {
      data.value = null
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Every month change hits the API again (no cached month data). */
  function step(delta: number) {
    const d = new Date(Date.UTC(year.value, month.value - 1 + delta, 1))
    return fetchMonth(d.getUTCFullYear(), d.getUTCMonth() + 1)
  }

  function reset() {
    data.value = null
    year.value = 2026
    month.value = 5
    error.value = null
  }

  return { year, month, data, loading, error, entries, legend, today, fetchMonth, step, reset }
})
