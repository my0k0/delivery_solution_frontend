import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { useShops } from '@/features/shops/api'
import type { OrderDateBasis } from '@/features/orders/api'
import { formatMmk } from '@/lib/money'
import { getApiErrorMessage } from '@/lib/api/client'
import { fetchShopStatement, reportKeys, type ShopStatementQuery } from '@/features/reports/api'
import { getCurrentDateRange } from '@/features/reports/date-range'
import { ReportDateRange } from '@/features/reports/ReportDateRange'
import { ReportExportButtons } from '@/features/reports/ReportExportButtons'

const STATUS_SUMMARIES = [
  { key: 'receivedCount', label: 'Received' },
  { key: 'outForDeliveryCount', label: 'Out for delivery' },
  { key: 'deliveredCount', label: 'Delivered' },
  { key: 'returnedCount', label: 'Returned' },
  { key: 'cancelledCount', label: 'Cancelled' },
] as const

export function ShopStatementPage() {
  const initialRange = getCurrentDateRange()
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialRange.dateTo)
  const [dateBasis, setDateBasis] = useState<OrderDateBasis>('ENTRY')
  const [shopId, setShopId] = useState('')
  const shops = useShops({ page: 1, perPage: 100 })
  const query: ShopStatementQuery = { dateFrom, dateTo, dateBasis, shopId }
  const statement = useQuery({ queryKey: reportKeys.shopStatement(query), queryFn: () => fetchShopStatement(query), enabled: Boolean(shopId && dateFrom && dateTo && dateFrom <= dateTo) })
  const exportParameters = { dateFrom, dateTo, dateBasis, shopId }

  return <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Shop statement</h1><p className="text-sm text-muted-foreground">Order totals and balance by shop.</p></div>{shopId && <ReportExportButtons endpoint="/reports/shop-statement/export" parameters={exportParameters} />}</div>
    <ReportDateRange dateFrom={dateFrom} dateTo={dateTo} dateBasis={dateBasis} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onDateBasisChange={setDateBasis} />
    <section aria-label="Shop statement filters" className="rounded-lg border bg-card p-4"><div className="flex max-w-xl flex-col gap-2"><label className="text-sm font-medium" htmlFor="statement-shop">Shop</label><select id="statement-shop" className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={shopId} onChange={(event) => setShopId(event.target.value)}><option value="">Choose a shop</option>{(shops.data?.data ?? []).map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></div></section>
    {dateFrom > dateTo ? <p role="alert" className="text-sm text-destructive">The start date must not be after the end date.</p> : !shopId ? <EmptyState title="Choose a shop" description="Select a shop and date range to view its statement." /> : statement.isLoading ? <div aria-label="Loading shop statement" className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-24 rounded-lg border bg-muted" />)}</div> : statement.isError ? <EmptyState title="Could not load the shop statement" description={getApiErrorMessage(statement.error)} /> : statement.data ? <>
      <h2 className="text-base font-semibold">{statement.data.shopName} · {statement.data.dateFrom} to {statement.data.dateTo} · {statement.data.dateBasis === 'DELIVERED' ? 'Delivered date' : 'Entry date'}</h2>
      <section aria-label="Order counts by status" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{STATUS_SUMMARIES.map((summary) => <Card size="sm" key={summary.key}><CardHeader><CardTitle className="text-xs text-muted-foreground">{summary.label}</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{statement.data[summary.key]}</p></CardContent></Card>)}</section>
      <section aria-label="Shop statement totals" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MoneySummary title="Package price total" amount={statement.data.priceTotal} />
        <MoneySummary title="Delivery fee total" amount={statement.data.feeTotal} />
        <MoneySummary title="COD collected on delivered orders" amount={statement.data.codCollected} />
        <MoneySummary title="COD expected on open orders" amount={statement.data.codExpected} />
        <MoneySummary title="Net owed to shop · delivered" amount={statement.data.netOwedToShopDelivered} />
        <MoneySummary title="Net owed to shop · pending" amount={statement.data.pendingNetOwedToShop} />
      </section>
      <p className="text-xs text-muted-foreground">Net owed to shop follows the delivery workflow money rules. Positive means the company owes the shop; negative means the shop owes the company.</p>
    </> : null}
  </div>
}

function MoneySummary({ title, amount }: { title: string; amount: string }) {
  return <Card size="sm"><CardHeader><CardTitle className="text-xs leading-5 text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="break-words font-mono text-lg font-semibold tabular-nums">{formatMmk(amount)}</p></CardContent></Card>
}
