import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useShops } from '@/features/shops/api'
import { ORDER_STATUSES, type OrderDateBasis, type OrderStatus } from '@/features/orders/api'
import { formatMmk } from '@/lib/money'
import { getApiErrorMessage } from '@/lib/api/client'
import { fetchOrderReport, reportKeys, type OrderReportQuery } from '@/features/reports/api'
import { getCurrentDateRange } from '@/features/reports/date-range'
import { ReportDateRange } from '@/features/reports/ReportDateRange'
import { ReportExportButtons } from '@/features/reports/ReportExportButtons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const PAGE_SIZE = 20

function stringOrDash(value: unknown): string {
  return typeof value === 'string' ? value : '—'
}

export function OrdersReportPage() {
  const initialRange = getCurrentDateRange()
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialRange.dateTo)
  const [dateBasis, setDateBasis] = useState<OrderDateBasis>('ENTRY')
  const [shopId, setShopId] = useState('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const shops = useShops({ page: 1, perPage: 100 })
  const query: OrderReportQuery = {
    dateFrom,
    dateTo,
    dateBasis,
    ...(shopId ? { shopId } : {}),
    ...(status ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    page,
    perPage: PAGE_SIZE,
  }
  const report = useQuery({ queryKey: reportKeys.orderReport(query), queryFn: () => fetchOrderReport(query), enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo) })
  const exportParameters = {
    dateFrom,
    dateTo,
    dateBasis,
    ...(shopId ? { shopId } : {}),
    ...(status ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }

  function updateFilter(update: () => void) {
    setPage(1)
    update()
  }

  return <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Order report</h1><p className="text-sm text-muted-foreground">Order-level amounts and status for the selected date range.</p></div><ReportExportButtons endpoint="/reports/orders/export" parameters={exportParameters} /></div>
    <ReportDateRange dateFrom={dateFrom} dateTo={dateTo} dateBasis={dateBasis} onDateFromChange={(value) => updateFilter(() => setDateFrom(value))} onDateToChange={(value) => updateFilter(() => setDateTo(value))} onDateBasisChange={(value) => updateFilter(() => setDateBasis(value))} />
    <section aria-label="Order report filters" className="grid min-w-0 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-2"><label className="text-sm font-medium" htmlFor="order-report-shop">Shop</label><select id="order-report-shop" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={shopId} onChange={(event) => updateFilter(() => setShopId(event.target.value))}><option value="">All shops</option>{(shops.data?.data ?? []).map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></div>
      <div className="flex min-w-0 flex-col gap-2"><label className="text-sm font-medium" htmlFor="order-report-status">Status</label><select id="order-report-status" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value as OrderStatus | ''))}><option value="">All statuses</option>{ORDER_STATUSES.map((orderStatus) => <option key={orderStatus} value={orderStatus}>{orderStatus.replaceAll('_', ' ')}</option>)}</select></div>
      <div className="flex min-w-0 flex-col gap-2"><label className="text-sm font-medium" htmlFor="order-report-search">Search orders</label><Input id="order-report-search" type="search" value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} placeholder="Tracking, customer name, or phone" /></div>
    </section>
    {dateFrom > dateTo ? <p role="alert" className="text-sm text-destructive">The start date must not be after the end date.</p> : report.isLoading ? <div aria-label="Loading order report" className="animate-pulse space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-12 rounded-md bg-muted" />)}</div> : report.isError ? <EmptyState title="Could not load the order report" description={getApiErrorMessage(report.error)} /> : report.data?.data.length ? <>
      <p className="text-sm text-muted-foreground">{report.data.meta.total.toLocaleString()} matching orders · Page {report.data.meta.page} of {Math.max(1, report.data.meta.totalPages)} · Visible page totals are shown below.</p>
      <div className="min-w-0 overflow-x-auto rounded-lg border"><Table>
         <TableHeader><TableRow><TableHead>Tracking</TableHead><TableHead>Customer name</TableHead><TableHead>Customer phone</TableHead><TableHead>Delivery address</TableHead><TableHead>Shop</TableHead><TableHead>Township</TableHead><TableHead>Status</TableHead><TableHead>Assignee</TableHead><TableHead className="text-right">Package price</TableHead><TableHead className="text-right">Delivery fee</TableHead><TableHead className="text-right">COD to collect</TableHead><TableHead className="text-right">Net owed to shop</TableHead></TableRow></TableHeader>
         <TableBody>{report.data.data.map((order) => <TableRow key={order.id}><TableCell className="whitespace-nowrap font-mono">{order.trackingCode}</TableCell><TableCell className="whitespace-nowrap">{order.customerName}</TableCell><TableCell className="whitespace-nowrap">{stringOrDash(order.customerPhone)}</TableCell><TableCell className="min-w-48 max-w-72">{stringOrDash(order.deliveryAddress)}</TableCell><TableCell>{order.shopName}</TableCell><TableCell>{stringOrDash(order.townshipName)}</TableCell><TableCell><Badge variant={order.status === 'CANCELLED' ? 'destructive' : 'secondary'}>{order.status.replaceAll('_', ' ')}</Badge></TableCell><TableCell>{stringOrDash(order.assigneeName)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(order.packagePrice)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(order.deliveryFee)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(order.codToCollect)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(order.netOwedToShop)}</TableCell></TableRow>)}</TableBody>
         <TableFooter><TableRow><TableCell colSpan={8}>Filtered totals · {report.data.totals.orderCount} orders</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(report.data.totals.packagePrice)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(report.data.totals.deliveryFee)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(report.data.totals.codToCollect)}</TableCell><TableCell className="whitespace-nowrap text-right font-mono">{formatMmk(report.data.totals.netOwedToShop)}</TableCell></TableRow></TableFooter>
      </Table></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Page {report.data.meta.page} of {Math.max(1, report.data.meta.totalPages)}</span><div className="flex gap-2"><Button variant="outline" className="min-h-10" disabled={page <= 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}>Previous</Button><Button variant="outline" className="min-h-10" disabled={page >= report.data.meta.totalPages} onClick={() => setPage((currentPage) => Math.min(report.data.meta.totalPages, currentPage + 1))}>Next</Button></div></div>
    </> : <EmptyState title="No orders in this report" description="Change the date range or filters to see matching orders." />}
  </div>
}
