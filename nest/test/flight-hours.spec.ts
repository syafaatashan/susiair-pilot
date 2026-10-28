import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FlightHoursService } from '../src/flight-hours/flight-hours.service'
import { DocumentsService } from '../src/documents/documents.service'
import { SchedulesService } from '../src/schedules/schedules.service'
import type { Range } from '../src/common/types'

const root = join(import.meta.dirname, '..')
const hoursData = JSON.parse(readFileSync(join(root, 'data', 'mock-flight-hours.json'), 'utf-8'))
const TODAY = '2026-05-15'

const hoursMap = new Map<string, number>(
  hoursData.flightHours.map((e: { date: string; hours: number }) => [e.date, e.hours]),
)

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** Independent reference implementation written from the brief, not from the service. */
function referenceRollingSum(date: string, windowDays: number): number {
  let sum = 0
  for (let i = 0; i < windowDays; i++) sum += hoursMap.get(addDays(date, -i)) ?? 0
  return Math.round(sum * 10) / 10
}

describe('FlightHoursService.getSummary', () => {
  const service = new FlightHoursService()

  it('returns 15 points with today centred, for every range', () => {
    for (const range of ['1w', '1m', '3m', '6m', '1y'] as Range[]) {
      const res = service.getSummary(range)
      expect(res.today).toBe(TODAY)
      expect(res.chartData).toHaveLength(15)
      expect(res.chartData[7].date).toBe(TODAY)
      expect(res.chartData[0].date).toBe(addDays(TODAY, -7))
      expect(res.chartData[14].date).toBe(addDays(TODAY, 7))
    }
  })

  it('matches the brief bounds table', () => {
    const expected: Record<string, [number, number]> = {
      '1w': [40, 45],
      '1m': [100, 125],
      '3m': [300, 325],
      '6m': [600, 625],
      '1y': [1050, 1200],
    }
    for (const [range, [limit, yMax]] of Object.entries(expected)) {
      const res = service.getSummary(range as Range)
      expect([res.limit, res.yMax]).toEqual([limit, yMax])
    }
  })

  it('rolling sums match an independent recomputation (all ranges, all 15 points)', () => {
    const windows: Record<string, number> = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365 }
    for (const [range, windowDays] of Object.entries(windows)) {
      const res = service.getSummary(range as Range)
      for (const point of res.chartData) {
        expect(`${range} ${point.date}: ${point.value}`).toBe(
          `${range} ${point.date}: ${referenceRollingSum(point.date, windowDays)}`,
        )
      }
    }
  })

  it('edge case: zero-hour days contribute 0 and missing dates are not skipped', () => {
    const res = service.getSummary('1w')
    // 2026-05-09 has 0 hours in the dataset yet still yields a value
    expect(res.chartData.find((p) => p.date === '2026-05-09')!.value).toBeGreaterThan(0)
    // Days before the dataset start (2024-12-27) contribute 0 rather than throwing
    expect(service.getDailyHours('2024-01-01', '2024-01-03')).toEqual([
      { date: '2024-01-01', hours: 0 },
      { date: '2024-01-02', hours: 0 },
      { date: '2024-01-03', hours: 0 },
    ])
  })

  it('edge case: future dates in the display range still return a value', () => {
    const res = service.getSummary('1w')
    const future = res.chartData.filter((p) => p.date > res.today)
    expect(future).toHaveLength(7)
    for (const p of future) expect(typeof p.value).toBe('number')
  })

  it('edge case: some points exceed the red limit line and are still returned', () => {
    const res = service.getSummary('1w')
    expect(res.chartData.some((p) => p.value > res.limit)).toBe(true)
    expect(Math.max(...res.chartData.map((p) => p.value))).toBeLessThanOrEqual(res.yMax)
  })

  it('getDailyHours fills every calendar day in the range, inclusive', () => {
    const rows = service.getDailyHours('2026-05-01', '2026-05-05')
    expect(rows).toEqual([
      { date: '2026-05-01', hours: 3.8 },
      { date: '2026-05-02', hours: 0 },
      { date: '2026-05-03', hours: 0 },
      { date: '2026-05-04', hours: 4 },
      { date: '2026-05-05', hours: 0.9 },
    ])
  })

  it('rollingWindowBluffing is the exact required method name', () => {
    expect(typeof (service as unknown as Record<string, unknown>).rollingWindowBluffing).toBe('function')
  })
})

describe('DocumentsService', () => {
  const service = new DocumentsService()

  it('recomputes daysRemaining and urgency status from the dataset', () => {
    const docs = service.getDocuments()
    const byId = Object.fromEntries(docs.map((d) => [d.id, d]))
    expect(byId.doc_recurrent.status).toBe('safe')
    expect(byId.doc_license.status).toBe('expired')
    expect(byId.doc_security.status).toBe('expired')
    expect(byId.doc_medical.status).toBe('soon')
    for (const d of docs) {
      const expected = d.daysRemaining <= 0 ? 'expired' : d.daysRemaining <= 30 ? 'soon' : 'safe'
      expect(`${d.id}=${d.status}`).toBe(`${d.id}=${expected}`)
    }
  })
})

describe('SchedulesService', () => {
  const service = new SchedulesService()

  it('filters to the requested month only and exposes today + legend', () => {
    const may = service.getMonth(2026, 5)
    expect(may.today).toBe(TODAY)
    expect(may.legend).toHaveLength(10)
    expect(may.schedules).toHaveLength(21)
    expect(may.schedules.every((s) => s.duty_date.startsWith('2026-05'))).toBe(true)
    expect(service.getMonth(2026, 4).schedules.length).toBeGreaterThan(0)
    expect(service.getMonth(2026, 7).schedules).toHaveLength(0)
  })
})
