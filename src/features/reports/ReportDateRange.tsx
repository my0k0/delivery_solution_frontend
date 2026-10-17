import type { OrderDateBasis } from '@/features/orders/api'
import { Input } from '@/components/ui/input'

interface ReportDateRangeProps {
  dateFrom: string
  dateTo: string
  /**
   * Omit both to hide the basis control. A report that fixes its own basis per
   * bucket (rider payout: earned by delivery date, pending by entry date) has
   * nothing for the user to choose, and a rendered control that changes nothing
   * misreports what the dates mean.
   */
  dateBasis?: OrderDateBasis
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onDateBasisChange?: (value: OrderDateBasis) => void
}

export function ReportDateRange({
  dateFrom,
  dateTo,
  dateBasis,
  onDateFromChange,
  onDateToChange,
  onDateBasisChange,
}: ReportDateRangeProps) {
  const showsDateBasis = dateBasis !== undefined && onDateBasisChange !== undefined

  return (
    <section
      aria-label="Report date filters"
      className={`grid min-w-0 gap-3 rounded-lg border bg-card p-4 ${showsDateBasis ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="report-date-from">From</label>
        <Input id="report-date-from" type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="report-date-to">To</label>
        <Input id="report-date-to" type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
      </div>
      {showsDateBasis && (
        <div className="flex min-w-0 flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="report-date-basis">Date basis</label>
          <select
            id="report-date-basis"
            className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={dateBasis}
            onChange={(event) => onDateBasisChange(event.target.value as OrderDateBasis)}
          >
            <option value="ENTRY">Entry date</option>
            <option value="DELIVERED">Delivered date</option>
          </select>
        </div>
      )}
    </section>
  )
}
