function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDate(): string {
  return formatLocalDate(new Date())
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
