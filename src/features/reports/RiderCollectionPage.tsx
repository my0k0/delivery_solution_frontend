import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchRiders } from '@/features/riders/api'
import type { OrderDateBasis } from '@/features/orders/api'
import { ReportDateRange } from '@/features/reports/ReportDateRange'
import { ReportExportButtons } from '@/features/reports/ReportExportButtons'
import { getCurrentDateRange } from '@/features/reports/date-range'
import { fetchRiderCollection, reportKeys, type RiderReportQuery } from '@/features/reports/api'
import { formatMmk } from '@/lib/money'
import { getApiErrorMessage } from '@/lib/api/client'

export function RiderCollectionPage() {
  const initialRange = getCurrentDateRange()
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialRange.dateTo)
  const [dateBasis, setDateBasis] = useState<OrderDateBasis>('ENTRY')
  const [riderId, setRiderId] = useState('')
  const riders = useQuery({ queryKey: ['operations', 'riders', 'report'], queryFn: () => fetchRiders({ page: 1, perPage: 100 }) })
  const query: RiderReportQuery = { dateFrom, dateTo, dateBasis, ...(riderId ? { riderId } : {}) }
  const report = useQuery({ queryKey: reportKeys.riderCollection(query), queryFn: () => fetchRiderCollection(query), enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo) })
  const exportParameters = { dateFrom, dateTo, dateBasis, ...(riderId ? { riderId } : {}) }

  return <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Rider collection</h1><p className="text-sm text-muted-foreground">Expected COD to hand back, grouped by rider and day.</p></div><ReportExportButtons endpoint="/reports/rider-collection/export" parameters={exportParameters} /></div>
    <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">Expected amount only — this is not cash received or a receipt confirmation.</p>
    <ReportDateRange dateFrom={dateFrom} dateTo={dateTo} dateBasis={dateBasis} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onDateBasisChange={setDateBasis} />
    <div className="flex max-w-xl flex-col gap-2"><label className="text-sm font-medium" htmlFor="collection-rider">Rider</label><select id="collection-rider" className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={riderId} onChange={(event) => setRiderId(event.target.value)}><option value="">All riders</option>{(riders.data?.data ?? []).map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}</select></div>
    {dateFrom > dateTo ? <p role="alert" className="text-sm text-destructive">The start date must not be after the end date.</p> : report.isLoading ? <div aria-label="Loading rider collection report" className="animate-pulse space-y-2">{[0, 1, 2].map((item) => <div key={item} className="h-12 rounded-md bg-muted" />)}</div> : report.isError ? <EmptyState title="Could not load rider collection" description={getApiErrorMessage(report.error)} /> : report.data?.data.length ? <div className="min-w-0 overflow-x-auto rounded-lg border"><Table>
      <TableHeader><TableRow><TableHead>Rider</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Delivered orders</TableHead><TableHead className="text-right">Awaiting approval</TableHead><TableHead className="text-right">Expected COD to hand back</TableHead><TableHead className="text-right">Awaiting approval COD</TableHead></TableRow></TableHeader>
      <TableBody>{report.data.data.map((row) => <TableRow key={`${row.riderId}-${row.date}`}><TableCell className="font-medium">{row.riderName}</TableCell><TableCell className="whitespace-nowrap">{row.date}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.deliveredOrderCount}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.awaitingApprovalOrderCount}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(row.expectedCodToHandBack)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(row.awaitingApprovalCod)}</TableCell></TableRow>)}</TableBody>
      <TableFooter><TableRow><TableCell colSpan={2}>Report total</TableCell><TableCell className="text-right font-mono tabular-nums">{report.data.totals.deliveredOrderCount}</TableCell><TableCell className="text-right font-mono tabular-nums">{report.data.totals.awaitingApprovalOrderCount}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(report.data.totals.expectedCodToHandBack)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(report.data.totals.awaitingApprovalCod)}</TableCell></TableRow></TableFooter>
    </Table></div> : <EmptyState title="No rider collection rows" description="There is no expected COD for the selected dates and rider." />}
  </div>
}
