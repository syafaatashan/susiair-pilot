export const VALID_RANGES = ['1w', '1m', '3m', '6m', '1y'] as const
export type Range = (typeof VALID_RANGES)[number]

export interface FlightHourEntry { date: string; hours: number }

export interface FlightHoursData {
  pilot: { name: string; totalFlightHours: number }
  limits: { daily: number; weekly: number; monthly: number; annual: number }
  chartBounds: Record<string, { limit: number; max: number; windowDays: number; displayRangeDays: number }>
  flightHours: FlightHourEntry[]
}

export interface DocumentEntry {
  id: string
  label: string
  expiryDate: string
}

export interface DocumentsData {
  today: string
  thresholds: { warningDays: number; comment?: string }
  documents: DocumentEntry[]
}

export type DutyType =
  | 'DTY' | 'RLV' | 'SCK' | 'TRD' | 'TRX' | 'ADM' | 'FER' | 'MED' | 'REC' | 'ULV'

export interface ScheduleEntry {
  id: string
  duty_date: string
  status: number
  base_name: string
  base_color: string
  duty_type: DutyType
  count_schedules: number
  count_logbooks: number
}

export interface LegendEntry {
  code: string
  label: string
  color: string
}

export interface SchedulesData {
  today: string
  fieldGuide: Record<string, string>
  legend: LegendEntry[]
  schedules: ScheduleEntry[]
}

export interface DocumentStatus {
  id: string
  label: string
  expiryDate: string
  daysRemaining: number
  status: 'safe' | 'soon' | 'expired'
}

export interface ChartPoint { date: string; value: number }

export interface SummaryResponse {
  today: string
  range: string
  limit: number
  yMax: number
  chartData: ChartPoint[]
}
