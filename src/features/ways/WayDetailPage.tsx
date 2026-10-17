import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { orderKeys } from '@/features/orders/api'
import { CloseWayDialog } from '@/features/ways/CloseWayDialog'
import { MoveWayOrdersDialog } from '@/features/ways/MoveWayOrdersDialog'
import { PayWayAnywayDialog } from '@/features/ways/PayWayAnywayDialog'
import { WayStateBadge } from '@/features/ways/WayStateBadge'
import { closeWay, fetchWay, fetchWays, moveWayOrders, payWayAnyway, wayKeys } from '@/features/ways/api'
import { getApiErrorMessage } from '@/lib/api/client'

export function WayDetailPage() {
  const { wayId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const wayQuery = useQuery({ queryKey: wayKeys.detail(wayId), queryFn: () => fetchWay(wayId), enabled: Boolean(wayId) })
  const targetWaysQuery = useQuery({
    queryKey: wayKeys.list({ riderId: wayQuery.data?.riderId }),
    queryFn: () => fetchWays({ riderId: wayQuery.data?.riderId }),
    enabled: Boolean(wayQuery.data?.riderId),
  })
  const way = wayQuery.data

  async function refreshWayData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: wayKeys.all }),
      queryClient.invalidateQueries({ queryKey: wayKeys.detail(wayId) }),
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: orderKeys.riderBoard }),
    ])
  }

  async function handleCloseWay() {
    await closeWay(wayId)
    toast.success('Way closed')
    await refreshWayData()
  }

  async function handleMoveOrders(orderIds: string[], targetWayId: string) {
    await moveWayOrders(wayId, { orderIds, targetWayId })
    toast.success('Orders moved to the selected way')
    await refreshWayData()
  }

  async function handlePayAnyway(reason: string) {
    await payWayAnyway(wayId, { reason })
    toast.success('Way commission marked paid anyway')
    await refreshWayData()
  }

  if (wayQuery.isLoading) return <div className="h-48 animate-pulse rounded-lg border border-border bg-muted" aria-label="Loading way" />
  if (wayQuery.isError || !way) return <div className="flex flex-col gap-3"><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(wayQuery.error)}</p><Button variant="outline" onClick={() => navigate('/ways')}>Back to ways</Button></div>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="min-h-10 min-w-10" aria-label="Back to ways" onClick={() => navigate('/ways')}><ArrowLeft className="size-4" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">{way.riderName} · {way.wayDate} · {way.sequence}</h1><WayStateBadge state={way.state} /></div>
            <p className="text-sm text-muted-foreground">{way.isOpen ? 'Open for new assignments' : 'Closed to new assignments'} · {way.orderCount} {way.orderCount === 1 ? 'order' : 'orders'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <MoveWayOrdersDialog way={way} orders={way.orders} targetWays={targetWaysQuery.data ?? []} onMove={handleMoveOrders} />
          <PayWayAnywayDialog way={way} onPayAnyway={handlePayAnyway} />
          <CloseWayDialog way={way} onCloseWay={handleCloseWay} />
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Way commission summary">
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Commission rate</p><p className="mt-1 font-mono">{way.commissionRate} MMK</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Commission amount</p><p className="mt-1 font-mono font-semibold">{way.commissionAmount} MMK</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Pending amount</p><p className="mt-1 font-mono">{way.pendingAmount} MMK</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Way status</p><p className="mt-1"><Badge variant={way.isOpen ? 'secondary' : 'outline'}>{way.isOpen ? 'Open' : 'Closed'}</Badge></p></div>
        {way.payAnywayReason && <div className="sm:col-span-2 xl:col-span-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Pay anyway reason</p><p className="mt-1">{way.payAnywayReason}</p></div>}
      </section>

      <section className="flex flex-col gap-3">
        <div><h2 className="text-base font-semibold">Orders on this way</h2><p className="text-sm text-muted-foreground">Orders assigned to {way.riderName} for this way.</p></div>
        {!way.orders.length ? <EmptyState title="No orders on this way" description="Orders assigned to this rider will appear here." />
          : <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Tracking</TableHead><TableHead>Status</TableHead><TableHead>Added</TableHead><TableHead>Delivered at</TableHead></TableRow></TableHeader>
              <TableBody>
                {way.orders.map((order) => <TableRow key={order.id}>
                  <TableCell><Link to={`/orders/${order.id}`} className="font-mono font-medium underline-offset-4 hover:underline">{order.trackingCode}</Link></TableCell>
                  <TableCell><Badge variant={order.status === 'DELIVERED' ? 'secondary' : 'outline'}>{order.status.replaceAll('_', ' ')}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(order.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="whitespace-nowrap">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}</TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
          </div>}
      </section>
    </div>
  )
}
