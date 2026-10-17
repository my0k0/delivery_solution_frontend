import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OrderForm } from '@/features/orders/OrderForm'
import type { Order, OrderBody, UpdateOrderBody } from '@/features/orders/api'

interface OrderFormDialogProps {
  order: Order | null
  open: boolean
  pending: boolean
  onClose: () => void
  onSave: (body: OrderBody | UpdateOrderBody) => Promise<void>
}

export function OrderFormDialog({ order, open, pending, onClose, onSave }: OrderFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{order ? `Edit ${order.trackingCode}` : 'Create order'}</DialogTitle>
          <DialogDescription>
            {order ? 'Every saved field change is recorded in the order audit.' : 'Township defaults prefill the fee, assignee, and estimated date.'}
          </DialogDescription>
        </DialogHeader>
        <OrderForm key={order?.id ?? 'new-order'} order={order} pending={pending} onCancel={onClose} onSave={onSave} />
      </DialogContent>
    </Dialog>
  )
}
