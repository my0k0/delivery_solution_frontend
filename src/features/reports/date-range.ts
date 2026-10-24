function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDate(): string {
  return formatLocalDate(new Date())
}

/**
 * True for a real `YYYY-MM-DD` calendar date.
 *
 * A pattern check alone accepts `2026-02-31` and `2026-13-01`, which pass the
 * shape test, survive the URL round-trip, and are then sent to an API that
 * rejects them — a pasted link would render an error page instead of the list.
 * Round-tripping through `Date` catches the impossible ones: the constructor
 * normalizes them to another day, so the parts no longer match.
 */
export function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

export function getDefaultReportDateRange(): { dateFrom: string; dateTo: string } {
  const dateTo = new Date()
  const dateFrom = new Date(dateTo)
  dateFrom.setDate(dateFrom.getDate() - 6)
  return { dateFrom: formatLocalDate(dateFrom), dateTo: formatLocalDate(dateTo) }
}

export function getCurrentDateRange(): { dateFrom: string; dateTo: string } {
  const today = getTodayDate()
  return { dateFrom: today, dateTo: today }
}
