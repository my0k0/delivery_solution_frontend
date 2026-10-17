import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/lib/auth/usePermission'
import { getApiErrorMessage } from '@/lib/api/client'
import { fetchRiders } from '@/features/riders/api'
import { useShops } from '@/features/shops/api'
import { useCustomers } from '@/features/customers/api'
import {
  approveOrder,
  assignOrder,
  cancelOrder,
  fetchDeliveryPartners,
  fetchOrder,
  fetchOrderAudit,
  fetchTownships,
  markPartnerDelivered,
  orderKeys,
  postponeOrder,
  sendBackOrder,
  updateOrder,
  type AssignBody,
  type Order,
  type OrderReason,
  type SendBackBody,
  type UpdateOrderBody,
} from '@/features/orders/api'
import { calculateCodToCollect, calculateNetOwedToShop } from '@/features/orders/money'
import { OrderFormDialog } from '@/features/orders/OrderFormDialog'
import { AssignOrderDialog } from '@/features/orders/AssignOrderDialog'
import { PostponeOrderDialog } from '@/features/orders/PostponeOrderDialog'
import { CancelOrderDialog } from '@/features/orders/CancelOrderDialog'
import { SendBackOrderDialog } from '@/features/orders/SendBackOrderDialog'
import { ApproveOrderDialog } from '@/features/orders/ApproveOrderDialog'
import { MarkDeliveredDialog } from '@/features/orders/MarkDeliveredDialog'
import { fetchWay, wayKeys } from '@/features/ways/api'

type OrderAction =
  | { type: 'assign'; body: AssignBody }
  | { type: 'postpone'; body: OrderReason }
  | { type: 'cancel'; body: OrderReason }
  | { type: 'send-back'; body: SendBackBody }
  | { type: 'approve' }
  | { type: 'mark-delivered' }
  | { type: 'edit'; body: UpdateOrderBody }

function auditValue(value: unknown): string {
  if (value === null) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value) ?? '—'
}

function formatAssignee(order: Order, riders: Array<{ id: string; name: string }>, partners: Array<{ id: string; name: string }>): string {
  if (order.assigneeType === 'RIDER') return riders.find((rider) => rider.id === order.riderId)?.name ?? 'Rider'
  if (order.assigneeType === 'PARTNER') return partners.find((partner) => partner.id === order.partnerId)?.name ?? 'Delivery partner'
  return 'Unassigned'
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canUpdate = usePermission('orders.update')
  const canCancel = usePermission('orders.cancel')
  const canApprove = usePermission('deliveries.approve')
  const canReadWays = usePermission('ways.read')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [activeDialog, setActiveDialog] = useState<'assign' | 'postpone' | 'cancel' | 'send-back' | 'approve' | 'mark-delivered' | null>(null)
  const orderQuery = useQuery({ queryKey: orderKeys.detail(orderId), queryFn: () => fetchOrder(orderId), enabled: Boolean(orderId) })
  const wayQuery = useQuery({
    queryKey: wayKeys.detail(orderQuery.data?.wayId ?? ''),
    queryFn: () => fetchWay(orderQuery.data?.wayId ?? ''),
    enabled: Boolean(canReadWays && orderQuery.data?.wayId),
  })
  const auditQuery = useQuery({ queryKey: orderKeys.audit(orderId), queryFn: () => fetchOrderAudit(orderId), enabled: Boolean(orderId) })
  const shops = useShops({ page: 1, perPage: 100 })
  const customers = useCustomers({ page: 1, perPage: 100 })
  const townships = useQuery({ queryKey: orderKeys.townships, queryFn: fetchTownships })
  const riders = useQuery({ queryKey: ['operations', 'riders', 'active'], queryFn: () => fetchRiders({ page: 1, perPage: 100, status: 'ACTIVE' }) })
  const partners = useQuery({ queryKey: orderKeys.partners, queryFn: fetchDeliveryPartners })
  const actionMutation = useMutation({
    mutationFn: async (action: OrderAction) => {
      if (action.type === 'assign') return assignOrder(orderId, action.body)
      if (action.type === 'postpone') return postponeOrder(orderId, action.body)
      if (action.type === 'cancel') return cancelOrder(orderId, action.body)
      if (action.type === 'send-back') return sendBackOrder(orderId, action.body)
      if (action.type === 'approve') return approveOrder(orderId)
      if (action.type === 'mark-delivered') return markPartnerDelivered(orderId)
      return updateOrder(orderId, action.body)
    },
    onSuccess: async (_updatedOrder, action) => {
      const successMessage = action.type === 'assign' ? 'Assignee updated'
        : action.type === 'postpone' ? 'Order postponed'
          : action.type === 'cancel' ? 'Order cancelled'
            : action.type === 'send-back' ? 'Order sent back to rider queue'
              : action.type === 'approve' ? 'Delivery approved'
                : action.type === 'mark-delivered' ? 'Partner order marked delivered'
                  : 'Order changes saved'
      toast.success(successMessage)
      setActiveDialog(null)
      setIsEditOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) }),
        queryClient.invalidateQueries({ queryKey: orderKeys.audit(orderId) }),
        queryClient.invalidateQueries({ queryKey: orderKeys.riderBoard }),
        queryClient.invalidateQueries({ queryKey: wayKeys.all }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const order = orderQuery.data
  const canEdit = canUpdate && order !== undefined && order.status !== 'CANCELLED'
  const canAssignOrder = canUpdate && (order?.status === 'PENDING' || order?.status === 'ASSIGNED')
  const canPostponeOrder = canUpdate && order?.status === 'ASSIGNED'
  const canCancelOrder = canCancel && (order?.status === 'PENDING' || order?.status === 'ASSIGNED')
  const canReviewOrder = canApprove && order?.status === 'AWAITING_APPROVAL'
  const canMarkPartnerDelivered = canApprove && order?.status === 'ASSIGNED' && order.assigneeType === 'PARTNER'
  const isDelayed = Boolean(order?.estimatedDeliveryDate && order.estimatedDeliveryDate < new Date().toISOString().slice(0, 10)
    && !['DELIVERED', 'CANCELLED'].includes(order.status))

  async function saveAction(action: OrderAction) {
    await actionMutation.mutateAsync(action)
  }

  if (orderQuery.isLoading) return <div className="h-72 animate-pulse rounded-lg bg-muted" aria-label="Loading order details" />
  if (orderQuery.isError || !order) return <div className="flex flex-col gap-3"><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(orderQuery.error)}</p><Button variant="outline" onClick={() => navigate('/orders')}>Back to orders</Button></div>

  const shopName = shops.data?.data.find((shop) => shop.id === order.shopId)?.name ?? order.shopId
  const customerName = customers.data?.data.find((customer) => customer.id === order.customerId)?.name ?? order.customerId
  const townshipName = townships.data?.find((township) => township.id === order.townshipId)?.name ?? 'No township'
  const riderRecords = riders.data?.data ?? []
  const partnerRecords = partners.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" aria-label="Back to orders" onClick={() => navigate('/orders')}><ArrowLeft className="size-4" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">{order.trackingCode}</h1><Badge className={order.status === 'DELIVERED' ? 'bg-success text-success-foreground' : order.status === 'AWAITING_APPROVAL' ? 'bg-warning text-warning-foreground' : ''} variant={order.status === 'CANCELLED' ? 'destructive' : 'secondary'}>{order.status.replaceAll('_', ' ')}</Badge>{isDelayed && <Badge variant="destructive">Delayed</Badge>}</div>
            <p className="text-sm text-muted-foreground">Created {new Date(order.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button variant="outline" onClick={() => setIsEditOpen(true)}><Pencil className="size-4" />Edit order</Button>}
          {canAssignOrder && <Button variant="outline" onClick={() => setActiveDialog('assign')}>Assign / clear</Button>}
          {canPostponeOrder && <Button variant="outline" onClick={() => setActiveDialog('postpone')}>Postpone</Button>}
          {canCancelOrder && <Button variant="destructive" onClick={() => setActiveDialog('cancel')}>Cancel</Button>}
          {canReviewOrder && <><Button variant="outline" onClick={() => setActiveDialog('send-back')}>Send back</Button><Button onClick={() => setActiveDialog('approve')}>Approve</Button></>}
          {canMarkPartnerDelivered && <Button onClick={() => setActiveDialog('mark-delivered')}>Mark delivered</Button>}
        </div>
      </div>

      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Order summary">
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Shop</p><p className="mt-1 font-medium">{shopName}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p><p className="mt-1 font-medium">{customerName}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Township</p><p className="mt-1 font-medium">{townshipName}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</p><p className="mt-1 font-medium">{formatAssignee(order, riderRecords, partnerRecords)}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery way</p><p className="mt-1 font-medium">{order.assigneeType === 'PARTNER' ? 'Partner delivery · no way' : order.wayId ? canReadWays && wayQuery.data ? <Link to={`/ways/${wayQuery.data.id}`} className="underline-offset-4 hover:underline">{wayQuery.data.wayDate} · {wayQuery.data.riderName}</Link> : canReadWays ? 'Loading way…' : 'Assigned to a way' : 'Not assigned to a way'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Package price</p><p className="mt-1 font-mono">{order.packagePrice}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery fee</p><p className="mt-1 font-mono">{order.deliveryFee}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">COD to collect</p><p className="mt-1 font-mono font-semibold">{calculateCodToCollect(order)}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Net owed to shop (estimated)</p><p className="mt-1 font-mono font-semibold">{calculateNetOwedToShop(order)}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated delivery</p><p className="mt-1">{order.estimatedDeliveryDate ?? '—'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Delivered at</p><p className="mt-1">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Payment to shop</p><p className="mt-1">Package {order.isPackagePaidToShop ? 'paid' : 'unpaid'} · Fee {order.isFeePaidToShop ? 'paid' : 'unpaid'}</p></div>
        {order.partnerTrackingNo && <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Partner tracking</p><p className="mt-1">{order.partnerTrackingNo}</p></div>}
        {order.deliveryAddress && <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery address</p><p className="mt-1">{order.deliveryAddress}</p></div>}
        {order.notes && <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p><p className="mt-1">{order.notes}</p></div>}
        {order.cancelReason && <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Cancellation reason</p><p className="mt-1">{order.cancelReason}</p></div>}
      </section>

      <section className="flex flex-col gap-3">
        <div><h2 className="text-base font-semibold">Status history</h2><p className="text-sm text-muted-foreground">Every state change is retained, including shop-visible reasons and internal notes.</p></div>
        {order.history.length ? <ol className="space-y-3 border-l border-border pl-4">
          {order.history.map((entry) => <li key={entry.id} className="relative rounded-md border border-border bg-card p-3 text-sm before:absolute before:-left-[1.35rem] before:top-4 before:size-2 before:rounded-full before:bg-primary">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{entry.fromStatus ?? 'Created'} → {entry.toStatus}</span><time className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</time></div>
            {entry.changedBy && <p className="mt-1 text-xs text-muted-foreground">Changed by user {entry.changedBy}</p>}
            {entry.reason && <p className="mt-1">Reason: {entry.reason}</p>}
            {entry.internalNote && <p className="mt-1 text-muted-foreground">Internal note: {entry.internalNote}</p>}
          </li>)}
        </ol> : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No status history is available.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <div><h2 className="text-base font-semibold">Field audit</h2><p className="text-sm text-muted-foreground">Field-by-field values recorded for each saved edit.</p></div>
        {auditQuery.isLoading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : auditQuery.isError ? <p role="alert" className="text-sm text-destructive">Could not load field audit.</p> : auditQuery.data?.length ? <div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Changed</TableHead><TableHead>Field</TableHead><TableHead>Previous value</TableHead><TableHead>New value</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>
          {auditQuery.data.map((entry) => <TableRow key={entry.id}><TableCell className="whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</TableCell><TableCell className="font-medium">{entry.field}</TableCell><TableCell className="max-w-64 break-words">{auditValue(entry.oldValue)}</TableCell><TableCell className="max-w-64 break-words">{auditValue(entry.newValue)}</TableCell><TableCell>{entry.reason ?? '—'}</TableCell></TableRow>)}
        </TableBody></Table></div> : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No field edits have been recorded.</p>}
      </section>

      <Link to="/orders" className="w-fit text-sm underline-offset-4 hover:underline">Back to orders</Link>

      {isEditOpen && <OrderFormDialog open={isEditOpen} order={order} pending={actionMutation.isPending} onClose={() => setIsEditOpen(false)} onSave={async (body) => saveAction({ type: 'edit', body: body as UpdateOrderBody })} />}
      <AssignOrderDialog order={activeDialog === 'assign' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onSave={async (value) => {
        const body: AssignBody = value.assigneeType === 'RIDER' ? { riderId: value.assigneeId } : value.assigneeType === 'PARTNER' ? { partnerId: value.assigneeId } : { riderId: null, partnerId: null }
        await saveAction({ type: 'assign', body })
      }} />
      <PostponeOrderDialog order={activeDialog === 'postpone' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onSave={async (reason) => saveAction({ type: 'postpone', body: { reason } })} />
      <CancelOrderDialog order={activeDialog === 'cancel' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onSave={async (reason) => saveAction({ type: 'cancel', body: { reason } })} />
      <SendBackOrderDialog order={activeDialog === 'send-back' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onSave={async (body) => saveAction({ type: 'send-back', body })} />
      <ApproveOrderDialog order={activeDialog === 'approve' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onConfirm={async () => saveAction({ type: 'approve' })} />
      <MarkDeliveredDialog order={activeDialog === 'mark-delivered' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onConfirm={async () => saveAction({ type: 'mark-delivered' })} />
    </div>
  )
}
