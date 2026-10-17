import { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadShopFile, useShopOrders, type ShopOrder, type ShopOrderStatus, type ShopOrdersQuery } from './api'
import { SHOP_STATUS_OPTIONS, formatShopDate, formatShopDateTime, getShopStatusLabel } from './shop-display'
import { getTodayDate } from '@/features/reports/date-range'
import { getApiErrorMessage } from '@/lib/api/client'
import { formatMmk } from '@/lib/money'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { usePermission } from '@/lib/auth/gate'

const ORDER_PAGE_SIZE = 20

function OrderStatusBadge({ status }: { status: ShopOrderStatus }) {
  const badgeStyle = status === 'DELIVERED' ? 'bg-success/15 text-foreground' : status === 'CANCELLED' || status === 'RETURNED' ? 'bg-destructive/10 text-foreground' : status === 'OUT_FOR_DELIVERY' ? 'bg-warning/25 text-foreground' : 'bg-muted text-foreground'
  return <Badge className={badgeStyle}>{getShopStatusLabel(status)}</Badge>
}

function NeedsAttentionMarker() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-1 text-xs font-medium text-foreground"><span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />Needs attention</span>
}

function OrderCard({ order }: { order: ShopOrder }) {
  return <article className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><Link to={`/shop/orders/${order.id}`} className="break-all font-mono text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">{order.trackingCode}</Link><p className="mt-1 truncate text-sm font-medium">{order.customerName}</p>{order.customerPhone && <p className="text-xs text-muted-foreground">{order.customerPhone}</p>}</div>
      <OrderStatusBadge status={order.displayStatus} />
    </div>
    {order.needsAttention && <NeedsAttentionMarker />}
    <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-sm">
      <div><dt className="text-xs text-muted-foreground">Price</dt><dd className="break-words font-mono tabular-nums">{formatMmk(order.packagePrice)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Fee</dt><dd className="break-words font-mono tabular-nums">{formatMmk(order.deliveryFee)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="break-words font-mono font-semibold tabular-nums">{formatMmk(order.total)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Delivered</dt><dd>{formatShopDateTime(order.deliveredAt)}</dd></div>
      <div className="col-span-2"><dt className="text-xs text-muted-foreground">Estimated date</dt><dd>{formatShopDate(order.estimatedDeliveryDate)}</dd></div>
    </dl>
  </article>
}

function OrdersSkeleton() {
  return <div aria-label="Loading orders" className="flex flex-col gap-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div>
}

export function ShopOrdersPage() {
  const today = getTodayDate()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [dateBasis, setDateBasis] = useState<'ENTRY' | 'DELIVERED'>('ENTRY')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [status, setStatus] = useState<'ALL' | ShopOrderStatus>('ALL')
  const [needsAttention, setNeedsAttention] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const canExport = usePermission('shop-reports.export')
  const query: ShopOrdersQuery = {
    dateFrom,
    dateTo,
    dateBasis,
    timeFrom: timeFrom || undefined,
    timeTo: timeTo || undefined,
    displayStatus: status === 'ALL' ? undefined : status,
    needsAttention: needsAttention || undefined,
    search: search.trim() || undefined,
    page,
    perPage: ORDER_PAGE_SIZE,
  }
  const isDateRangeValid = Boolean(dateFrom && dateTo && dateFrom <= dateTo)
  const orders = useShopOrders(query)

  function resetPage(action: () => void) {
    action()
    setPage(1)
  }

  async function exportOrders(format: 'csv' | 'xlsx') {
    setIsExporting(true)
    try {
      await downloadShopFile('/shop/orders/export', {
        dateFrom,
        dateTo,
        dateBasis,
        timeFrom: timeFrom || undefined,
        timeTo: timeTo || undefined,
        displayStatus: status === 'ALL' ? undefined : status,
        needsAttention: needsAttention || undefined,
        search: search.trim() || undefined,
        format,
      })
      toast.success(`${format.toUpperCase()} orders downloaded`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not export orders'))
    } finally {
      setIsExporting(false)
    }
  }

  const hasResults = (orders.data?.data.length ?? 0) > 0

  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Orders</h1><p className="text-sm text-muted-foreground">Search and review your packages.</p></div>
      {canExport && <div className="flex gap-2"><button type="button" disabled={isExporting || !isDateRangeValid} onClick={() => void exportOrders('csv')} className="min-h-10 rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">Export CSV</button><button type="button" disabled={isExporting || !isDateRangeValid} onClick={() => void exportOrders('xlsx')} className="min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Export XLSX</button></div>}
    </div>
    <section aria-label="Order filters" className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="From" htmlFor="orders-date-from"><input id="orders-date-from" type="date" value={dateFrom} onChange={(event) => resetPage(() => setDateFrom(event.target.value))} className="filter-control" /></Field>
      <Field label="To" htmlFor="orders-date-to"><input id="orders-date-to" type="date" value={dateTo} onChange={(event) => resetPage(() => setDateTo(event.target.value))} className="filter-control" /></Field>
      <Field label="Date basis" htmlFor="orders-date-basis"><select id="orders-date-basis" value={dateBasis} onChange={(event) => resetPage(() => setDateBasis(event.target.value as 'ENTRY' | 'DELIVERED'))} className="filter-control"><option value="ENTRY">Entry date</option><option value="DELIVERED">Delivered date</option></select></Field>
      <Field label="Status" htmlFor="orders-status"><select id="orders-status" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as 'ALL' | ShopOrderStatus))} className="filter-control"><option value="ALL">All statuses</option>{SHOP_STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></Field>
      <Field label="Time from (optional)" htmlFor="orders-time-from"><input id="orders-time-from" type="time" value={timeFrom} onChange={(event) => resetPage(() => setTimeFrom(event.target.value))} className="filter-control" /></Field>
      <Field label="Time to (optional)" htmlFor="orders-time-to"><input id="orders-time-to" type="time" value={timeTo} onChange={(event) => resetPage(() => setTimeTo(event.target.value))} className="filter-control" /></Field>
      <Field label="Search" htmlFor="orders-search"><input id="orders-search" type="search" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Customer, phone, tracking" className="filter-control" /></Field>
      <label className="flex min-h-10 items-center gap-2 self-end rounded-md border px-3 text-sm focus-within:ring-2 focus-within:ring-ring"><input type="checkbox" checked={needsAttention} onChange={(event) => resetPage(() => setNeedsAttention(event.target.checked))} className="size-4 accent-primary" />Needs attention</label>
    </section>
    {!isDateRangeValid ? <p role="alert" className="text-sm text-destructive">The start date must not be after the end date.</p> : orders.isLoading ? <OrdersSkeleton /> : orders.isError ? <EmptyState title="Could not load orders" description={getApiErrorMessage(orders.error)} /> : !hasResults ? <EmptyState title="No orders found" description="Try changing the date range or clearing one of the filters." /> : orders.data ? <>
      <div className="hidden min-w-0 overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full min-w-[68rem] text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{['Customer / tracking', 'Price', 'Fee', 'Total', 'Status', 'Delivered', 'Estimated date', 'Attention'].map((heading) => <th key={heading} scope="col" className="px-3 py-3 font-medium">{heading}</th>)}</tr></thead>
          <tbody>{orders.data.data.map((order) => <tr key={order.id} className="border-t align-top hover:bg-muted/30">
            <td className="max-w-56 px-3 py-3"><Link to={`/shop/orders/${order.id}`} className="break-all font-mono text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">{order.trackingCode}</Link><p className="mt-1 truncate font-medium">{order.customerName}</p>{order.customerPhone && <p className="text-xs text-muted-foreground">{order.customerPhone}</p>}</td>
            <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{formatMmk(order.packagePrice)}</td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{formatMmk(order.deliveryFee)}</td><td className="whitespace-nowrap px-3 py-3 font-mono font-semibold tabular-nums">{formatMmk(order.total)}</td>
            <td className="px-3 py-3"><OrderStatusBadge status={order.displayStatus} /></td><td className="whitespace-nowrap px-3 py-3">{formatShopDateTime(order.deliveredAt)}</td><td className="whitespace-nowrap px-3 py-3">{formatShopDate(order.estimatedDeliveryDate)}</td><td className="px-3 py-3">{order.needsAttention ? <NeedsAttentionMarker /> : '—'}</td>
          </tr>)}</tbody>
          <tfoot className="border-t bg-muted/40 font-semibold"><tr><th scope="row" className="px-3 py-3 text-left">Totals · {orders.data.totals.orderCount} orders</th><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{formatMmk(orders.data.totals.packagePrice)}</td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{formatMmk(orders.data.totals.deliveryFee)}</td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{formatMmk(orders.data.totals.total)}</td><td colSpan={4} /></tr></tfoot>
        </table>
      </div>
      <div className="flex min-w-0 flex-col gap-3 md:hidden">{orders.data.data.map((order) => <OrderCard key={order.id} order={order} />)}<div className="rounded-lg border bg-muted/40 p-4 text-sm"><p className="font-semibold">Totals · {orders.data.totals.orderCount} orders</p><div className="mt-2 grid grid-cols-2 gap-2"><p>Price <span className="block break-words font-mono tabular-nums">{formatMmk(orders.data.totals.packagePrice)}</span></p><p>Fee <span className="block break-words font-mono tabular-nums">{formatMmk(orders.data.totals.deliveryFee)}</span></p><p className="col-span-2">Total <span className="block break-words font-mono font-semibold tabular-nums">{formatMmk(orders.data.totals.total)}</span></p></div></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-sm text-muted-foreground">{orders.data.meta.total} orders · Page {orders.data.meta.page} of {Math.max(orders.data.meta.totalPages, 1)}</p>
        <div className="flex gap-2"><button type="button" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={page <= 1} className="min-h-10 rounded-md border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Previous</button><button type="button" onClick={() => setPage((currentPage) => Math.min(orders.data?.meta.totalPages ?? currentPage, currentPage + 1))} disabled={page >= orders.data.meta.totalPages} className="min-h-10 rounded-md border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Next</button></div>
      </div>
    </> : null}
  </div>
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={htmlFor} className="text-xs font-medium">{label}</label>{children}</div>
}
