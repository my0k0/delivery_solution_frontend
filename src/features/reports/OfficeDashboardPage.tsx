import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/api/client'
import { formatMmk } from '@/lib/money'
import { fetchOfficeDashboard, reportKeys, type OfficeDashboardQuery } from '@/features/reports/api'
import { getDefaultReportDateRange } from '@/features/reports/date-range'
import { FinancialComparisonChart, OrdersPerDayChart, TownshipSuccessChart, TopShopsChart } from '@/features/reports/DashboardCharts'

const KPI_LABELS: Record<string, string> = {
  todaysOrders: "Today's orders",
  awaitingApproval: 'Awaiting approval',
  codToCollectToday: 'COD to collect today',
  feeIncomeToday: 'Fee income today',
  delayedOrders: 'Delayed orders',
}

function DashboardSkeleton() {
  return <div aria-label="Loading office dashboard" className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((card) => <div key={card} className="h-28 rounded-lg border bg-muted" />)}</div>
    <div className="grid gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map((chart) => <div key={chart} className="h-72 rounded-lg border bg-muted" />)}</div>
  </div>
}

export function OfficeDashboardPage() {
  const initialRange = getDefaultReportDateRange()
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialRange.dateTo)
  const query: OfficeDashboardQuery = { dateFrom, dateTo, dateBasis: 'ENTRY' }
  const dashboard = useQuery({ queryKey: reportKeys.officeDashboard(query), queryFn: () => fetchOfficeDashboard(query), enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo) })

  return <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold tracking-tight">Office dashboard</h1><p className="text-sm text-muted-foreground">Daily operations and delivery performance.</p></div>
      <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-1"><label className="text-xs font-medium" htmlFor="dashboard-date-from">From</label><Input id="dashboard-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
        <div className="flex min-w-0 flex-col gap-1"><label className="text-xs font-medium" htmlFor="dashboard-date-to">To</label><Input id="dashboard-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
      </div>
    </div>
    {dateFrom > dateTo && <p className="text-sm text-destructive" role="alert">The start date must not be after the end date.</p>}
    {dashboard.isLoading ? <DashboardSkeleton /> : dashboard.isError ? <EmptyState title="Could not load the office dashboard" description={getApiErrorMessage(dashboard.error)} /> : dashboard.data ? <>
      <section aria-label="Today's key figures" className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-5">
        {dashboard.data.kpis.map((metric) => <Card className="min-w-0" key={metric.key} size="sm">
          <CardHeader><CardTitle className="text-xs leading-5 text-muted-foreground">{KPI_LABELS[metric.key] ?? metric.key}</CardTitle></CardHeader>
          <CardContent><p className="break-words font-mono text-xl font-semibold tabular-nums">{metric.key === 'codToCollectToday' || metric.key === 'feeIncomeToday' ? formatMmk(metric.amount) : metric.count.toLocaleString()}</p></CardContent>
        </Card>)}
      </section>
      <section className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label="Office performance charts">
        <OrdersPerDayChart data={dashboard.data.ordersPerDayByStatus} />
        <FinancialComparisonChart data={dashboard.data.feeIncomeVsPartnerCostVsCommission} />
        <TopShopsChart data={dashboard.data.topShops} />
        <TownshipSuccessChart data={dashboard.data.townshipSuccessRates} />
        <Card size="sm" className="min-w-0 xl:col-span-2">
          <CardHeader><CardTitle className="text-sm">Pending order age</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div><p className="text-sm text-muted-foreground">Average age of active orders in the selected range</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Average pending age, on a seven-day scale" aria-valuemin={0} aria-valuemax={7} aria-valuenow={Number(dashboard.data.averagePendingAgeDays)}><div className="h-full rounded-full bg-chart-2" style={{ width: `${Math.min(100, Number(dashboard.data.averagePendingAgeDays) / 7 * 100)}%` }} /></div><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>0 days</span><span>7 days</span></div></div>
            <p className="font-mono text-2xl font-semibold tabular-nums">{dashboard.data.averagePendingAgeDays} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          </CardContent>
        </Card>
      </section>
      <p className="text-xs text-muted-foreground">Today's figures are for {dashboard.data.today}. Charts use the selected entry-date range.</p>
    </> : null}
  </div>
}
