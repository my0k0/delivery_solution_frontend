import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/lib/auth/usePermission'
import { getApiErrorMessage } from '@/lib/api/client'
import { approveOrder, fetchOrders, orderKeys, sendBackOrder, type Order, type OrderFilters, type SendBackBody } from '@/features/orders/api'
import { wayKeys } from '@/features/ways/api'
import { calculateCodToCollect } from '@/features/orders/money'
import { ApproveOrderDialog } from '@/features/orders/ApproveOrderDialog'
import { SendBackOrderDialog } from '@/features/orders/SendBackOrderDialog'

export function ApprovalQueuePage() {
  const canApprove = usePermission('deliveries.approve')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [dialog, setDialog] = useState<'approve' | 'send-back' | null>(null)
  const queryClient = useQueryClient()
  const filters: OrderFilters = { page: 1, perPage: 100, status: 'AWAITING_APPROVAL' }
  const queue = useQuery({ queryKey: orderKeys.list(filters), queryFn: () => fetchOrders(filters) })
  const action = useMutation({
    mutationFn: (request: { order: Order; action: 'approve' } | { order: Order; action: 'send-back'; body: SendBackBody }) =>
      request.action === 'approve' ? approveOrder(request.order.id) : sendBackOrder(request.order.id, request.body),
    onSuccess: async (_updatedOrder, request) => {
      toast.success(request.action === 'approve' ? 'Delivery approved' : 'Order sent back to rider queue')
      setDialog(null)
      setSelectedOrder(null)
      await queryClient.invalidateQueries({ queryKey: orderKeys.all })
      await queryClient.invalidateQueries({ queryKey: wayKeys.all })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="text-xl font-semibold tracking-tight">Approval queue</h1><p className="text-sm text-muted-foreground">Review rider-submitted deliveries before COD is counted as received.</p></div>
      {queue.isLoading ? <div className="space-y-2" aria-label="Loading approval queue">{[0, 1, 2].map((row) => <div key={row} className="h-12 animate-pulse rounded-md bg-muted" />)}</div> : queue.isError ? <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(queue.error)}</p> : queue.data?.data.length ? <div className="overflow-x-auto rounded-lg border border-border">
        <Table><TableHeader><TableRow><TableHead>Tracking</TableHead><TableHead>Submitted</TableHead><TableHead>Assignee</TableHead><TableHead className="text-right">COD to collect</TableHead><TableHead className="text-right">Review</TableHead></TableRow></TableHeader><TableBody>
          {queue.data.data.map((order) => <TableRow key={order.id}>
            <TableCell><Link to={`/orders/${order.id}`} className="font-mono font-medium underline-offset-4 hover:underline">{order.trackingCode}</Link></TableCell>
            <TableCell>{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}</TableCell>
            <TableCell>{order.assigneeType === 'RIDER' ? 'Rider' : order.assigneeType === 'PARTNER' ? 'Partner' : 'Unassigned'}</TableCell>
            <TableCell className="text-right font-mono">{calculateCodToCollect(order)}</TableCell>
            <TableCell className="text-right"><div className="flex justify-end gap-2">{canApprove && <><Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setDialog('send-back') }}>Send back</Button><Button size="sm" onClick={() => { setSelectedOrder(order); setDialog('approve') }}>Approve</Button></>}</div></TableCell>
          </TableRow>)}
        </TableBody></Table>
      </div> : <EmptyState title="Queue is clear" description="Orders will appear here after a rider submits a delivery." />}
      {queue.data?.meta && <p className="text-sm text-muted-foreground">{queue.data.meta.total} order{queue.data.meta.total === 1 ? '' : 's'} awaiting approval</p>}
      <ApproveOrderDialog order={dialog === 'approve' ? selectedOrder : null} pending={action.isPending} onClose={() => setDialog(null)} onConfirm={async () => { if (selectedOrder) await action.mutateAsync({ order: selectedOrder, action: 'approve' }) }} />
      <SendBackOrderDialog order={dialog === 'send-back' ? selectedOrder : null} pending={action.isPending} onClose={() => setDialog(null)} onSave={async (body) => { if (selectedOrder) await action.mutateAsync({ order: selectedOrder, action: 'send-back', body }) }} />
    </div>
  )
}
