import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getApiErrorMessage } from '@/lib/api/client'
import { formatMmk } from '@/lib/money'
import { fetchRiderDashboard, reportKeys } from '@/features/reports/api'

export function RiderDashboardPage() {
  const dashboard = useQuery({ queryKey: reportKeys.riderDashboard, queryFn: fetchRiderDashboard })

  return <div className="mx-auto flex w-full min-w-0 max-w-screen-xl flex-col gap-5">
    <div><h1 className="text-xl font-semibold tracking-tight">My dashboard</h1><p className="text-sm text-muted-foreground">Your delivered orders, commission, and COD to hand back.</p></div>
    {dashboard.isLoading ? <div aria-label="Loading rider dashboard" className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3"><div className="col-span-2 h-28 rounded-lg border bg-muted sm:col-span-3" /><div className="h-28 rounded-lg border bg-muted" /><div className="h-28 rounded-lg border bg-muted" /><div className="h-28 rounded-lg border bg-muted" /></div> : dashboard.isError ? <EmptyState title="Could not load your dashboard" description={getApiErrorMessage(dashboard.error)} /> : dashboard.data ? <>
      <section aria-label="My delivery figures" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
        <Card size="sm"><CardHeader><CardTitle className="text-xs text-muted-foreground">Delivered today</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{dashboard.data.todayDeliveredCount}</p></CardContent></Card>
        <Card size="sm"><CardHeader><CardTitle className="text-xs text-muted-foreground">Delivered this week</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{dashboard.data.weekDeliveredCount}</p></CardContent></Card>
        <Card size="sm"><CardHeader><CardTitle className="text-xs text-muted-foreground">Delivered this month</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{dashboard.data.monthDeliveredCount}</p></CardContent></Card>
        <Card size="sm"><CardHeader><CardTitle className="text-xs text-muted-foreground">Commission earned</CardTitle></CardHeader><CardContent><p className="break-words font-mono text-lg font-semibold tabular-nums">{formatMmk(dashboard.data.commissionEarned)}</p></CardContent></Card>
        <Card size="sm"><CardHeader><CardTitle className="text-xs text-muted-foreground">Commission pending approval</CardTitle></CardHeader><CardContent><p className="break-words font-mono text-lg font-semibold tabular-nums">{formatMmk(dashboard.data.commissionPending)}</p></CardContent></Card>
        <Card size="sm"><CardHeader><CardTitle className="text-xs text-muted-foreground">COD to hand back</CardTitle></CardHeader><CardContent><p className="break-words font-mono text-lg font-semibold tabular-nums">{formatMmk(dashboard.data.codToHandBack)}</p></CardContent></Card>
      </section>
      <section className="min-w-0 rounded-lg border bg-card p-4" aria-label="Delivered orders per day">
        <h2 className="mb-3 text-sm font-semibold">Delivered orders per day</h2>
        {dashboard.data.ordersPerDay.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Orders</TableHead></TableRow></TableHeader><TableBody>{dashboard.data.ordersPerDay.map((day) => <TableRow key={day.date}><TableCell>{day.date}</TableCell><TableCell className="text-right font-mono tabular-nums">{day.orderCount}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No deliveries in the current month.</p>}
      </section>
    </> : null}
  </div>
}
