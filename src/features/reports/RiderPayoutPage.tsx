import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchRiders } from '@/features/riders/api'
import { ReportDateRange } from '@/features/reports/ReportDateRange'
import { ReportExportButtons } from '@/features/reports/ReportExportButtons'
import { getCurrentDateRange } from '@/features/reports/date-range'
import { fetchRiderPayout, reportKeys, type RiderReportQuery } from '@/features/reports/api'
import { formatMmk } from '@/lib/money'
import { getApiErrorMessage } from '@/lib/api/client'

const PAYOUT_TOTALS = [
  { key: 'earnedAmount', label: 'Earned' },
  { key: 'pendingApprovalAmount', label: 'Pending approval' },
] as const

export function RiderPayoutPage() {
  const initialRange = getCurrentDateRange()
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialRange.dateTo)
  const [riderId, setRiderId] = useState('')
  const riders = useQuery({ queryKey: ['operations', 'riders', 'payout-report'], queryFn: () => fetchRiders({ page: 1, perPage: 100 }) })
  const query: RiderReportQuery = { dateFrom, dateTo, ...(riderId ? { riderId } : {}) }
  const report = useQuery({ queryKey: reportKeys.riderPayout(query), queryFn: () => fetchRiderPayout(query), enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo) })
  const exportParameters = { dateFrom, dateTo, ...(riderId ? { riderId } : {}) }

  return <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Rider payout</h1><p className="text-sm text-muted-foreground">Commission per order: earned once the office approves the delivery, pending while it waits in the approval queue. Earned falls on the delivery date, pending on the entry date.</p></div><ReportExportButtons endpoint="/reports/rider-payout/export" parameters={exportParameters} /></div>
    <ReportDateRange dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
    <div className="flex max-w-xl flex-col gap-2"><label className="text-sm font-medium" htmlFor="payout-rider">Rider</label><select id="payout-rider" className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={riderId} onChange={(event) => setRiderId(event.target.value)}><option value="">All riders</option>{(riders.data?.data ?? []).map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}</select></div>
    {dateFrom > dateTo ? <p role="alert" className="text-sm text-destructive">The start date must not be after the end date.</p> : report.isLoading ? <div aria-label="Loading rider payout report" className="animate-pulse space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-12 rounded-md bg-muted" />)}</div> : report.isError ? <EmptyState title="Could not load rider payout" description={getApiErrorMessage(report.error)} /> : report.data ? <>
      <section aria-label="Rider payout totals" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{PAYOUT_TOTALS.map((summary) => <Card size="sm" key={summary.key}><CardHeader><CardTitle className="text-xs text-muted-foreground">{summary.label}</CardTitle></CardHeader><CardContent><p className="break-words font-mono text-lg font-semibold tabular-nums">{formatMmk(report.data.totals[summary.key])}</p></CardContent></Card>)}</section>
      {report.data.data.length ? <div className="min-w-0 overflow-x-auto rounded-lg border"><Table>
        <TableHeader><TableRow><TableHead>Rider</TableHead><TableHead className="text-right">Delivered orders</TableHead><TableHead className="text-right">Earned</TableHead><TableHead className="text-right">Pending approval</TableHead></TableRow></TableHeader>
        <TableBody>{report.data.data.map((row) => <TableRow key={row.riderId}><TableCell className="font-medium">{row.riderName}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.deliveredOrderCount}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(row.earnedAmount)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(row.pendingApprovalAmount)} <span className="text-xs text-muted-foreground">({row.pendingApprovalOrderCount})</span></TableCell></TableRow>)}</TableBody>
      </Table></div> : <EmptyState title="No rider payout rows" description="No delivered or awaiting-approval orders for the selected dates and rider." />}
    </> : null}
  </div>
}
