import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CircleDollarSign, PackageCheck, PackageOpen, Truck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMmk } from '@/lib/money'
import { getApiErrorMessage } from '@/lib/api/client'
import { getTodayDate } from '@/features/reports/date-range'
import { fetchShopDashboard, shopPortalKeys, type ShopDateQuery } from './api'
import type { components } from '@/types/api'

type ShopOrdersPerDay = components['schemas']['ShopOrdersPerDayDto']

const STATUS_SERIES = [
  { key: 'RECEIVED', label: 'Received', color: 'var(--chart-1)' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', color: 'var(--chart-2)' },
  { key: 'DELIVERED', label: 'Delivered', color: 'var(--chart-3)' },
  { key: 'CANCELLED', label: 'Cancelled', color: 'var(--chart-4)' },
  { key: 'RETURNED', label: 'Returned', color: 'var(--chart-5)' },
] as const

const STATUS_TILES = [
  { key: 'received', label: 'Received', icon: PackageOpen },
  { key: 'outForDelivery', label: 'Out for delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: PackageCheck },
  { key: 'cancelled', label: 'Cancelled', icon: AlertCircle },
  { key: 'needsAttention', label: 'Needs attention', icon: CircleDollarSign },
] as const

function DashboardSkeleton() {
  return <div className="flex flex-col gap-4" aria-label="Loading shop dashboard">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div>
    <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
    <Skeleton className="h-80 w-full" />
  </div>
}

function ShopOrdersChart({ data }: { data: ShopOrdersPerDay[] }) {
  const dates = [...new Set(data.map((item) => item.date))].sort()
  if (!dates.length) return <p className="flex min-h-44 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">No orders in this date range.</p>

  const width = 720
  const height = 270
  const plotLeft = 42
  const plotTop = 18
  const plotHeight = 190
  const plotBottom = plotTop + plotHeight
  const plotWidth = width - plotLeft - 12
  const dateWidth = plotWidth / dates.length
  const barWidth = Math.max(2, dateWidth * 0.62)
  const dateStep = Math.max(1, Math.ceil(dates.length / 8))
  const dateCounts = dates.map((date) => data.filter((item) => item.date === date).reduce((sum, item) => sum + item.orderCount, 0))
  const maximumCount = Math.max(1, ...dateCounts)

  return <>
    <div className="min-w-0" role="img" aria-label={`Stacked bar chart of daily order counts by display status for ${dates.length} dates. Use the data table below for exact counts.`}>
      <svg className="block h-auto w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {[0, 25, 50, 75, 100].map((percentage) => {
          const y = plotBottom - plotHeight * percentage / 100
          return <g key={percentage}><line x1={plotLeft} x2={width - 12} y1={y} y2={y} stroke="var(--border)" strokeDasharray={percentage === 0 ? undefined : '3 4'} /><text x={plotLeft - 8} y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">{Math.round(maximumCount * percentage / 100)}</text></g>
        })}
        {dates.map((date, dateIndex) => {
          const dailyValues = data.filter((item) => item.date === date)
          const x = plotLeft + dateIndex * dateWidth + (dateWidth - barWidth) / 2
          let nextY = plotBottom
          return <g key={date}>
            {STATUS_SERIES.map((series) => {
              const count = dailyValues.find((item) => item.displayStatus === series.key)?.orderCount ?? 0
              if (!count) return null
              const barHeight = plotHeight * count / maximumCount
              nextY -= barHeight
              return <rect key={series.key} x={x} y={nextY} width={barWidth} height={barHeight} fill={series.color} stroke="var(--card)" strokeWidth="1"><title>{`${date}: ${series.label}, ${count} orders`}</title></rect>
            })}
            {dateIndex % dateStep === 0 && <text x={x + barWidth / 2} y={plotBottom + 18} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">{date.slice(5).replace('-', '/')}</text>}
          </g>
        })}
        <text x="12" y={plotTop + plotHeight / 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" transform={`rotate(-90 12 ${plotTop + plotHeight / 2})`}>Orders</text>
      </svg>
    </div>
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Chart legend">
      {STATUS_SERIES.map((series) => <li key={series.key} className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-sm border border-foreground/20" style={{ backgroundColor: series.color }} />{series.label}</li>)}
    </ul>
    <details className="mt-3 rounded-md border px-3 py-2 text-sm">
      <summary className="min-h-8 cursor-pointer font-medium focus-visible:ring-2 focus-visible:ring-ring">View chart data</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <caption className="sr-only">Daily order counts by display status</caption>
          <thead><tr className="border-b text-muted-foreground"><th scope="col" className="p-2">Date</th>{STATUS_SERIES.map((series) => <th scope="col" className="p-2" key={series.key}>{series.label}</th>)}</tr></thead>
          <tbody>{dates.map((date) => <tr className="border-b last:border-0" key={date}><th scope="row" className="p-2 font-medium">{date}</th>{STATUS_SERIES.map((series) => <td className="p-2 tabular-nums" key={series.key}>{data.find((item) => item.date === date && item.displayStatus === series.key)?.orderCount ?? 0}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </>
}

export function ShopDashboardPage() {
  const today = getTodayDate()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const query: ShopDateQuery = { dateFrom, dateTo, dateBasis: 'ENTRY' }
  const isDateRangeValid = Boolean(dateFrom && dateTo && dateFrom <= dateTo)
  const dashboard = useQuery({ queryKey: shopPortalKeys.dashboard(query), queryFn: () => fetchShopDashboard(query), enabled: isDateRangeValid })

  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold tracking-tight">Shop dashboard</h1><p className="text-sm text-muted-foreground">A clear view of your orders and settlement.</p></div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <div className="flex min-w-32 flex-col gap-1"><label htmlFor="dashboard-date-from" className="text-xs font-medium">From</label><input id="dashboard-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring" /></div>
        <div className="flex min-w-32 flex-col gap-1"><label htmlFor="dashboard-date-to" className="text-xs font-medium">To</label><input id="dashboard-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring" /></div>
      </div>
    </div>
    {!isDateRangeValid ? <p role="alert" className="text-sm text-destructive">Choose a valid date range.</p> : dashboard.isLoading ? <DashboardSkeleton /> : dashboard.isError ? <EmptyState title="Could not load your dashboard" description={getApiErrorMessage(dashboard.error)} /> : dashboard.data ? <>
      <section aria-label="Orders by status" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {STATUS_TILES.map(({ key, label, icon: Icon }) => <Card key={key} size="sm" className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardTitle className="text-xs leading-5 text-muted-foreground">{label}</CardTitle><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></CardHeader>
          <CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{dashboard.data.counts[key]}</p></CardContent>
        </Card>)}
      </section>
      <section aria-label="Shop settlement summary" className="grid min-w-0 gap-3 sm:grid-cols-2">
        <MoneyCard title="COD collected" amount={dashboard.data.money.codCollected} description="From delivered orders" />
        <MoneyCard title="Net settlement (estimated)" amount={dashboard.data.money.netSettlementDelivered} description="Net owed on delivered orders" />
      </section>
      <Card className="min-w-0">
        <CardHeader><CardTitle className="text-base">Orders per day by status</CardTitle><p className="text-sm text-muted-foreground">{dateFrom} to {dateTo} · Entry date</p></CardHeader>
        <CardContent><ShopOrdersChart data={dashboard.data.ordersPerDayByStatus} /></CardContent>
      </Card>
    </> : null}
  </div>
}

function MoneyCard({ title, amount, description }: { title: string; amount: string; description: string }) {
  return <Card size="sm" className="min-w-0"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="break-words font-mono text-xl font-semibold tabular-nums">{formatMmk(amount)}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></CardContent></Card>
}
