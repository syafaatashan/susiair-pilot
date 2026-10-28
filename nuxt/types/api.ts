export interface Pilot {
  name: string
  totalFlightHours: number
  avatarUrl: string
}

export interface FlightHourDay {
  date: string
  hours: number
}

export type SummaryRange = '1w' | '1m' | '3m' | '6m' | '1y'

export interface ChartPoint {
  date: string
  value: number
}

export interface FlightHoursSummary {
  today: string
  range: SummaryRange
  limit: number
  yMax: number
  chartData: ChartPoint[]
}

export type DocumentStatus = 'safe' | 'soon' | 'expired'

export interface PilotDocument {
  id: string
  label: string
  expiryDate: string
  daysRemaining: number
  status: DocumentStatus
}

export interface ScheduleEntry {
  id: string
  duty_date: string
  status: number
  base_name: string
  base_color: string
  duty_type: string
  count_schedules: number
  count_logbooks: number
}

export interface LegendEntry {
  code: string
  label: string
  color: string
}

export interface MonthSchedules {
  today: string
  year: number
  month: number
  legend: LegendEntry[]
  schedules: ScheduleEntry[]
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}
