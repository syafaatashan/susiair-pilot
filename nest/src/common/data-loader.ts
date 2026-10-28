import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FlightHoursData, DocumentsData, SchedulesData } from './types.js'

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'data', file), 'utf-8'))
}

export function loadFlightHoursData(): FlightHoursData {
  return loadJson<FlightHoursData>('mock-flight-hours.json')
}

export function loadDocumentsData(): DocumentsData {
  return loadJson<DocumentsData>('mock-documents.json')
}

export function loadSchedulesData(): SchedulesData {
  return loadJson<SchedulesData>('mock-schedules.json')
}

export { readFileSync }
