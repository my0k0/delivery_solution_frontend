import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useShopOrder } from './api'
import { formatShopDate, formatShopDateTime, getShopStatusLabel } from './shop-display'
import { getApiErrorMessage } from '@/lib/api/client'
import { formatMmk } from '@/lib/money'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export function ShopOrderDetailPage() {
  const { orderId = '' } = useParams()
  const order = useShopOrder(orderId)

  if (order.isLoading) return <div className="flex flex-col gap-4" aria-label="Loading order"><Skeleton className="h-10 w-44" /><Skeleton className="h-60 w-full" /><Skeleton className="h-48 w-full" /></div>
  if (order.isError) {
    if (axios.isAxiosError(order.error) && order.error.response?.status === 404) return <EmptyState title="Order not found" description="This order is unavailable in your shop account." />
    return <EmptyState title="Could not load this order" description={getApiErrorMessage(order.error)} />
  }
  if (!order.data) return <EmptyState title="Order not found" description="This order is unavailable in your shop account." />

  const detail = order.data
  const statusStyle = detail.displayStatus === 'DELIVERED' ? 'bg-success/15 text-foreground' : detail.displayStatus === 'CANCELLED' || detail.displayStatus === 'RETURNED' ? 'bg-destructive/10 text-foreground' : detail.displayStatus === 'OUT_FOR_DELIVERY' ? 'bg-warning/25 text-foreground' : 'bg-muted text-foreground'

  return <div className="flex min-w-0 flex-col gap-4">
    <Link to="/shop/orders" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden="true" />Back to orders</Link>
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="break-all font-mono text-xl font-semibold tracking-tight">{detail.trackingCode}</h1><p className="mt-1 text-sm text-muted-foreground">Order details</p></div><Badge className={statusStyle}>{getShopStatusLabel(detail.displayStatus)}</Badge></div>
    {detail.needsAttention && <div className="flex min-w-0 items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>This order needs attention. See the history below for the shop-visible reason.</p></div>}
    <section className="grid min-w-0 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Order information">
      <DetailField label="Customer" value={detail.customerName} />
      <DetailField label="Phone" value={detail.customerPhone || '—'} />
      <DetailField label="Township" value={detail.townshipName || '—'} />
      <DetailField label="Delivery address" value={detail.deliveryAddress || '—'} />
      <DetailField label="Entry date" value={formatShopDateTime(detail.createdAt)} />
      <DetailField label="Delivered" value={formatShopDateTime(detail.deliveredAt)} />
      <DetailField label="Estimated date" value={formatShopDate(detail.estimatedDeliveryDate)} />
    </section>
    <section className="rounded-lg border bg-card p-4" aria-label="Order amounts"><h2 className="text-base font-semibold">Order amounts</h2><dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
      <MoneyField label="Package price" amount={detail.packagePrice} /><MoneyField label="Delivery fee" amount={detail.deliveryFee} /><MoneyField label="Total" amount={detail.total} emphasized /><MoneyField label="COD to collect" amount={detail.codToCollect} /><MoneyField label="Net settlement" amount={detail.netOwedToShop} />
    </dl></section>
    <section className="rounded-lg border bg-card p-4" aria-label="Order history"><h2 className="text-base font-semibold">Order history</h2>{detail.history.length ? <ol className="mt-4 flex flex-col">{detail.history.map((event, index) => <li key={`${event.createdAt}-${index}`} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
      <span aria-hidden="true" className="relative mt-1 flex size-4 items-center justify-center"><span className="size-2.5 rounded-full bg-primary" />{index < detail.history.length - 1 && <span className="absolute top-3.5 h-full w-px bg-border" />}</span>
      <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="font-medium">{getShopStatusLabel(event.displayStatus)}</p><time className="text-xs text-muted-foreground">{formatShopDateTime(event.createdAt)}</time></div>{event.reason && <p className="mt-1 break-words text-sm text-muted-foreground">{event.reason}</p>}</div>
    </li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No history available.</p>}</section>
  </div>
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>
}

function MoneyField({ label, amount, emphasized = false }: { label: string; amount: string; emphasized?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className={`mt-1 break-words font-mono tabular-nums ${emphasized ? 'text-base font-semibold' : 'text-sm'}`}>{formatMmk(amount)}</dd></div>
}
