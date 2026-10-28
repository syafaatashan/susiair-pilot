import { Injectable } from '@nestjs/common'
import { loadSchedulesData } from '../common/data-loader.js'
import type { SchedulesData, ScheduleEntry } from '../common/types.js'

@Injectable()
export class SchedulesService {
  private readonly data: SchedulesData

  constructor() {
    this.data = loadSchedulesData()
  }

  getMonth(year: number, month: number): {
    today: string
    year: number
    month: number
    legend: SchedulesData['legend']
    schedules: ScheduleEntry[]
  } {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return {
      today: process.env.APP_TODAY ?? this.data.today,
      year,
      month,
      legend: this.data.legend,
      schedules: this.data.schedules.filter((s) => s.duty_date.startsWith(prefix)),
    }
  }
}
