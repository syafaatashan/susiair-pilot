import { BadRequestException, Injectable } from '@nestjs/common'
import { loadFlightHoursData, loadSchedulesData } from '../common/data-loader.js'
import type { FlightHoursData, ChartPoint, SummaryResponse, Range } from '../common/types.js'

function addDaysUTC(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d + days)
  const date = new Date(ms)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000)
}

@Injectable()
export class FlightHoursService {
  private readonly data: FlightHoursData
  private readonly today: string
  private readonly hoursMap: Map<string, number>
  private readonly earliest: string
  private readonly latest: string

  constructor() {
    this.data = loadFlightHoursData()
    this.today = process.env.APP_TODAY ?? loadSchedulesData().today
    this.hoursMap = new Map(this.data.flightHours.map((e) => [e.date, e.hours]))
    const sorted = this.data.flightHours.map((e) => e.date).sort()
    this.earliest = sorted[0]
    this.latest = sorted[sorted.length - 1]
  }

  /** Returns hourly data within [from, to], filling missing dates with 0. */
  getDailyHours(from: string, to: string) {
    const result: { date: string; hours: number }[] = []
    const totalDays = daysBetween(from, to)
    for (let i = 0; i <= totalDays; i++) {
      const date = addDaysUTC(from, i)
      result.push({ date, hours: this.hoursMap.get(date) ?? 0 })
    }
    return result
  }

  /** Returns the rolling-sum chart data for the selected range toggle. */
  getSummary(range: Range): SummaryResponse {
    const bounds = this.data.chartBounds[range]
    if (!bounds) throw new BadRequestException(`Invalid range: ${range}`)

    const start = addDaysUTC(this.today, -bounds.displayRangeDays)
    const end = addDaysUTC(this.today, bounds.displayRangeDays)
    const chartData = this.rollingWindowBluffing(start, end, bounds.windowDays)

    return {
      today: this.today,
      range,
      limit: bounds.limit,
      yMax: bounds.max,
      chartData,
    }
  }

  /** Returns the *point* value at "today" for a given range (used by limit cards). */
  getCurrentValue(range: Range): number {
    const bounds = this.data.chartBounds[range]
    if (!bounds) throw new BadRequestException(`Invalid range: ${range}`)
    const start = addDaysUTC(this.today, -bounds.displayRangeDays)
    const end = addDaysUTC(this.today, bounds.displayRangeDays)
    const chart = this.rollingWindowBluffing(start, end, bounds.windowDays)
    const todayPoint = chart.find((p) => p.date === this.today)
    return todayPoint?.value ?? 0
  }

  /** Returns today's actual (non-rolling) flight hours. */
  getDailyTotal(): number {
    return this.hoursMap.get(this.today) ?? 0
  }

  // this is a rolling sum calculation :)
  rollingWindowBluffing(startDateStr: string, endDateStr: string, windowDays: number): ChartPoint[] {
    const result: ChartPoint[] = []
    const totalDays = daysBetween(startDateStr, endDateStr)
    for (let i = 0; i <= totalDays; i++) {
      const currentDay = addDaysUTC(startDateStr, i)
      let sum = 0
      // Sum hours for the preceding windowDays calendar days (including current day)
      for (let j = 0; j < windowDays; j++) {
        // Edge case: dates before the earliest available data contribute 0
        const lookbackDate = addDaysUTC(currentDay, -j)
        sum += this.hoursMap.get(lookbackDate) ?? 0
      }
      result.push({
        date: currentDay,
        value: Math.round(sum * 10) / 10, // round to 1 decimal
      })
    }
    return result
  }
}
