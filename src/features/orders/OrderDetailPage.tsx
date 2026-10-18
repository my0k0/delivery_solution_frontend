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
import {
  approveOrder,
  assignOrder,
  cancelOrder,
  clearShopAdvance,
  fetchOrder,
  fetchOrderAudit,
  markPartnerDelivered,
  orderKeys,
  postponeOrder,
  recordShopAdvance,
  sendBackOrder,
  updateOrder,
  type AssignBody,
  type OrderReason,
  type SendBackBody,
  type ShopAdvanceBody,
  type UpdateOrderBody,
} from '@/features/orders/api'
import { orderAuditValue, orderFieldLabel } from '@/features/orders/audit-fields'
import { calculateCodToCollect, calculateNetOwedToShop, NET_OWED_SIGN_NOTE } from '@/features/orders/money'
import { OrderFormDialog } from '@/features/orders/OrderFormDialog'
import { AssignOrderDialog } from '@/features/orders/AssignOrderDialog'
import { PostponeOrderDialog } from '@/features/orders/PostponeOrderDialog'
import { CancelOrderDialog } from '@/features/orders/CancelOrderDialog'
import { SendBackOrderDialog } from '@/features/orders/SendBackOrderDialog'
import { ApproveOrderDialog } from '@/features/orders/ApproveOrderDialog'
import { MarkDeliveredDialog } from '@/features/orders/MarkDeliveredDialog'
import { RecordShopAdvanceDialog } from '@/features/orders/RecordShopAdvanceDialog'
import { UndoShopAdvanceDialog } from '@/features/orders/UndoShopAdvanceDialog'

type OrderAction =
  | { type: 'assign'; body: AssignBody }
  | { type: 'postpone'; body: OrderReason }
  | { type: 'cancel'; body: OrderReason }
  | { type: 'send-back'; body: SendBackBody }
  | { type: 'approve' }
  | { type: 'mark-delivered' }
  | { type: 'record-advance'; body: ShopAdvanceBody }
  | { type: 'undo-advance'; body: ShopAdvanceBody }
  | { type: 'edit'; body: UpdateOrderBody }

/** Keyed on the action union, so a new action cannot ship without a message. */
const ORDER_ACTION_MESSAGES: Record<OrderAction['type'], string> = {
  assign: 'Assignee updated',
  postpone: 'Order postponed',
  cancel: 'Order cancelled',
  'send-back': 'Order sent back to rider queue',
  approve: 'Delivery approved',
  'mark-delivered': 'Partner order marked delivered',
  'record-advance': 'Shop advance recorded',
  'undo-advance': 'Shop advance cleared',
  edit: 'Order changes saved',
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canUpdate = usePermission('orders.update')
  const canCancel = usePermission('orders.cancel')
  const canApprove = usePermission('deliveries.approve')
  const canSettleShop = usePermission('orders.shop_settlement')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [activeDialog, setActiveDialog] = useState<'assign' | 'postpone' | 'cancel' | 'send-back' | 'approve' | 'mark-delivered' | 'record-advance' | 'undo-advance' | null>(null)
  const orderQuery = useQuery({ queryKey: orderKeys.detail(orderId), queryFn: () => fetchOrder(orderId), enabled: Boolean(orderId) })
  const auditQuery = useQuery({ queryKey: orderKeys.audit(orderId), queryFn: () => fetchOrderAudit(orderId), enabled: Boolean(orderId) })
  const actionMutation = useMutation({
    mutationFn: async (action: OrderAction) => {
      if (action.type === 'assign') return assignOrder(orderId, action.body)
      if (action.type === 'postpone') return postponeOrder(orderId, action.body)
      if (action.type === 'cancel') return cancelOrder(orderId, action.body)
      if (action.type === 'send-back') return sendBackOrder(orderId, action.body)
      if (action.type === 'approve') return approveOrder(orderId)
      if (action.type === 'mark-delivered') return markPartnerDelivered(orderId)
      if (action.type === 'record-advance') return recordShopAdvance(orderId, action.body)
      if (action.type === 'undo-advance') return clearShopAdvance(orderId, action.body)
      return updateOrder(orderId, action.body)
    },
    onSuccess: async (_updatedOrder, action) => {
      toast.success(ORDER_ACTION_MESSAGES[action.type])
      setActiveDialog(null)
      setIsEditOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) }),
        queryClient.invalidateQueries({ queryKey: orderKeys.audit(orderId) }),
        queryClient.invalidateQueries({ queryKey: orderKeys.riderBoard }),
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
  const isShopAdvanced = order?.shopAdvancedAt != null
  const canRecordAdvance = canSettleShop && order !== undefined && !isShopAdvanced && !order.isPackagePaidToShop
  const canClearAdvance = canSettleShop && isShopAdvanced && order?.status !== 'CANCELLED'
  const isDelayed = Boolean(order?.estimatedDeliveryDate && order.estimatedDeliveryDate < new Date().toISOString().slice(0, 10)
    && !['DELIVERED', 'CANCELLED'].includes(order.status))

  async function saveAction(action: OrderAction) {
    await actionMutation.mutateAsync(action)
  }

  if (orderQuery.isLoading) return <div className="h-72 animate-pulse rounded-lg bg-muted" aria-label="Loading order details" />
  if (orderQuery.isError || !order) return <div className="flex flex-col gap-3"><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(orderQuery.error)}</p><Button variant="outline" onClick={() => navigate('/orders')}>Back to orders</Button></div>

  const shopName = order.shopName ?? '—'
  const customerName = order.customerName ?? '—'
  const townshipName = order.townshipName ?? 'No township'
  const assigneeName = order.assigneeName ?? 'Unassigned'

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
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</p><p className="mt-1 font-medium">{assigneeName}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Rider commission</p><p className="mt-1 font-mono">{order.assigneeType === 'PARTNER' ? 'Partner delivery · no commission' : order.commissionFee}</p></div>
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
        <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">{NET_OWED_SIGN_NOTE}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-label="Shop advance">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Shop advance</h2>
            <p className="text-sm text-muted-foreground">
              Whether the company has already paid the shop the package price for this order. The recorded amount is
              snapshotted when it is recorded and does not follow later price edits.
            </p>
          </div>
          {canRecordAdvance && <Button onClick={() => setActiveDialog('record-advance')}>Record advance</Button>}
          {canClearAdvance && <Button variant="outline" onClick={() => setActiveDialog('undo-advance')}>Clear advance</Button>}
        </div>
        {isShopAdvanced ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Advanced amount</p><p className="mt-1 font-mono font-semibold">{order.shopAdvanceAmount}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Advanced on</p><p className="mt-1">{order.shopAdvancedAt ? new Date(order.shopAdvancedAt).toLocaleString() : '—'}</p></div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {order.isPackagePaidToShop
              ? 'No advance due — the customer paid the shop for this package.'
              : `Not yet advanced. The company still owes the shop the package price of ${order.packagePrice} for this order.`}
          </p>
        )}
        {isShopAdvanced && order.status === 'CANCELLED' && (
          <p className="text-sm text-muted-foreground">
            This order is cancelled, so the advance is money the shop owes back. It cannot be cleared here.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div><h2 className="text-base font-semibold">Status history</h2><p className="text-sm text-muted-foreground">Every state change is retained, including shop-visible reasons and internal notes.</p></div>
        {order.history.length ? <ol className="space-y-3 border-l border-border pl-4">
          {order.history.map((entry) => <li key={entry.id} className="relative rounded-md border border-border bg-card p-3 text-sm before:absolute before:-left-[1.35rem] before:top-4 before:size-2 before:rounded-full before:bg-primary">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{entry.fromStatus ?? 'Created'} → {entry.toStatus}</span><time className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</time></div>
            {entry.changedByName && <p className="mt-1 text-xs text-muted-foreground">Changed by {entry.changedByName}</p>}
            {entry.reason && <p className="mt-1">Reason: {entry.reason}</p>}
            {entry.internalNote && <p className="mt-1 text-muted-foreground">Internal note: {entry.internalNote}</p>}
          </li>)}
        </ol> : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No status history is available.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <div><h2 className="text-base font-semibold">Field audit</h2><p className="text-sm text-muted-foreground">Field-by-field values recorded for each saved edit.</p></div>
        {auditQuery.isLoading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : auditQuery.isError ? <p role="alert" className="text-sm text-destructive">Could not load field audit.</p> : auditQuery.data?.length ? <div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Changed</TableHead><TableHead>Field</TableHead><TableHead>Previous value</TableHead><TableHead>New value</TableHead></TableRow></TableHeader><TableBody>
          {auditQuery.data.map((entry) => <TableRow key={entry.id}><TableCell className="whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</TableCell><TableCell className="font-medium">{orderFieldLabel(entry.field)}</TableCell><TableCell className="max-w-64 break-words">{orderAuditValue(entry.field, entry.oldValue)}</TableCell><TableCell className="max-w-64 break-words">{orderAuditValue(entry.field, entry.newValue)}</TableCell></TableRow>)}
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
      <RecordShopAdvanceDialog order={activeDialog === 'record-advance' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onSave={async (reason) => saveAction({ type: 'record-advance', body: reason === undefined ? {} : { reason } })} />
      <UndoShopAdvanceDialog order={activeDialog === 'undo-advance' ? order : null} pending={actionMutation.isPending} onClose={() => setActiveDialog(null)} onSave={async (reason) => saveAction({ type: 'undo-advance', body: reason === undefined ? {} : { reason } })} />
    </div>
  )
}
