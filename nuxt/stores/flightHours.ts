import type { FlightHourDay, FlightHoursSummary, SummaryRange } from '~/types/api'

export const SUMMARY_RANGES: SummaryRange[] = ['1w', '1m', '3m', '6m', '1y']

export interface LimitCard {
  key: 'daily' | 'weekly' | 'monthly' | 'annual'
  label: string
  window: string
  hours: number
  limit: number
}

/** Regulatory limits are fixed by the brief; `today`/window values come from the API. */
const LIMITS = { daily: 8, weekly: 40, monthly: 100, annual: 1050 }

export const useFlightHoursStore = defineStore('flightHours', () => {
  const range = ref<SummaryRange>('1w')
  /** GET /flight-hours/summary drives the chart (limit, yMax, series). */
  const summary = ref<FlightHoursSummary | null>(null)
  /** GET /flight-hours?from=today&to=today drives the Daily card. */
  const todayHours = ref<number | null>(null)
  /** Weekly / Monthly / Annual read the value at `date === today` from each summary. */
  const cards = ref<LimitCard[]>([
    { key: 'daily', label: 'Daily', window: 'Today', hours: 0, limit: LIMITS.daily },
    { key: 'weekly', label: 'Weekly', window: 'Rolling 7 days', hours: 0, limit: LIMITS.weekly },
    { key: 'monthly', label: 'Monthly', window: 'Rolling 30 days', hours: 0, limit: LIMITS.monthly },
    { key: 'annual', label: 'Annual', window: 'Rolling 365 days', hours: 0, limit: LIMITS.annual }
  ])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const today = computed(() => summary.value?.today ?? '')

  function setCard(key: LimitCard['key'], hours: number, limit: number) {
    cards.value = cards.value.map((c) => (c.key === key ? { ...c, hours, limit } : c))
  }

  function valueOn(s: FlightHoursSummary, date: string): number {
    return s.chartData.find((p) => p.date === date)?.value ?? 0
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const api = useApi()
      // Weekly first: its `today` is the authoritative "today" for the whole screen.
      const weekly = await api.get<FlightHoursSummary>('/flight-hours/summary', { range: '1w' })
      summary.value = weekly
      const t = weekly.today
      setCard('weekly', valueOn(weekly, t), weekly.limit)

      const [daily, monthly, annual] = await Promise.all([
        // Daily card = hours of the today date only — never `new Date()`.
        api.get<FlightHourDay[]>('/flight-hours', { from: t, to: t }),
        api.get<FlightHoursSummary>('/flight-hours/summary', { range: '1m' }),
        api.get<FlightHoursSummary>('/flight-hours/summary', { range: '1y' })
      ])
      todayHours.value = daily[0]?.hours ?? 0
      setCard('daily', todayHours.value, LIMITS.daily)
      setCard('monthly', valueOn(monthly, t), monthly.limit)
      setCard('annual', valueOn(annual, t), annual.limit)
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  async function setRange(next: SummaryRange) {
    if (next === range.value && summary.value) return
    range.value = next
    loading.value = true
    try {
      summary.value = await useApi().get<FlightHoursSummary>('/flight-hours/summary', { range: next })
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  return { range, summary, todayHours, cards, loading, error, today, fetchAll, setRange }
})
