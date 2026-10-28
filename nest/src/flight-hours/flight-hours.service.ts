import { BadRequestException, Injectable } from '@nestjs/common'
import { loadFlightHoursData } from '../common/data-loader.js'
import { APP_TODAY, MAX_RANGE_DAYS, addDays, daysBetween } from '../common/config.js'
import type { FlightHoursData, ChartPoint, SummaryResponse, Range } from '../common/types.js'

@Injectable()
export class FlightHoursService {
  private readonly data: FlightHoursData
  private readonly today: string
  private readonly hoursMap: Map<string, number>

  constructor() {
    this.data = loadFlightHoursData()
    this.today = APP_TODAY
    this.hoursMap = new Map(this.data.flightHours.map((e) => [e.date, e.hours]))
  }

  /** Returns hourly data within [from, to], filling missing dates with 0. */
  getDailyHours(from: string, to: string) {
    if (daysBetween(from, to) < 0) throw new BadRequestException('from must not be after to')
    const totalDays = daysBetween(from, to)
    if (totalDays > MAX_RANGE_DAYS)
      throw new BadRequestException(`range must not exceed ${MAX_RANGE_DAYS} days`)

    const result: { date: string; hours: number }[] = []
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(from, i)
      result.push({ date, hours: this.hoursMap.get(date) ?? 0 })
    }
    return result
  }

  /** Returns the rolling-sum chart data for the selected range toggle. */
  getSummary(range: Range): SummaryResponse {
    const bounds = this.data.chartBounds[range]
    if (!bounds) throw new BadRequestException(`Invalid range: ${range}`)

    const start = addDays(this.today, -bounds.displayRangeDays)
    const end = addDays(this.today, bounds.displayRangeDays)

    return {
      today: this.today,
      range,
      limit: bounds.limit,
      yMax: bounds.max,
      chartData: this.rollingWindowBluffing(start, end, bounds.windowDays),
    }
  }

  // this is a rolling sum calculation :)
  rollingWindowBluffing(startDateStr: string, endDateStr: string, windowDays: number): ChartPoint[] {
    const result: ChartPoint[] = []
    const totalDays = daysBetween(startDateStr, endDateStr)
    for (let i = 0; i <= totalDays; i++) {
      const currentDay = addDays(startDateStr, i)
      let sum = 0
      // Sum the preceding windowDays calendar days, including the current day.
      // Dates before the earliest available data contribute 0 rather than being skipped.
      for (let j = 0; j < windowDays; j++) {
        sum += this.hoursMap.get(addDays(currentDay, -j)) ?? 0
      }
      result.push({ date: currentDay, value: Math.round(sum * 10) / 10 })
    }
    return result
  }
}
