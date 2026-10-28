/**
 * Single source of truth for the "today" reference date.
 *
 * The brief says: "Treat today as 15 May 2026 in your logic. Do not use
 * new Date() to represent today. Hardcode it or make it configurable."
 *
 * NOTE: mock-documents.json ships its own `today` of 2026-05-31 while
 * mock-schedules.json ships 2026-05-15. Using each file's own value would make
 * the app inconsistent (and would make a deployed instance behave differently
 * from a local one), so we use ONE configurable value everywhere, defaulting to
 * the date the brief mandates. Set APP_TODAY=2026-05-31 to reproduce the
 * documents dataset's own reading.
 */
export const APP_TODAY: string = process.env.APP_TODAY ?? '2026-05-15'

/** Parses YYYY-MM-DD into a UTC timestamp, avoiding timezone/DST drift. */
export function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole calendar days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000)
}

/** Adds whole days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  return new Date(toUtcMs(dateStr) + days * 86_400_000).toISOString().slice(0, 10)
}

/** True when the string is a real calendar date in YYYY-MM-DD form. */
export function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (y < 1 || m < 1 || m > 12 || d < 1) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Maximum span accepted by GET /flight-hours, to keep responses bounded. */
export const MAX_RANGE_DAYS = 366
