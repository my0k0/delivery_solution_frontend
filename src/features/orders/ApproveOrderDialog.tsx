import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Order } from '@/features/orders/api'
import { usePermission } from '@/lib/auth/usePermission'

interface ApproveOrderDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function ApproveOrderDialog({ order, pending, onClose, onConfirm }: ApproveOrderDialogProps) {
  const canApproveDelivery = usePermission('deliveries.approve')
  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve delivered order?</DialogTitle><DialogDescription>Confirm delivery for {order?.trackingCode}. This confirms the delivery; it does not record cash received — the COD becomes expected back from the rider.</DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Review later</Button>{canApproveDelivery && <Button type="button" disabled={pending} onClick={() => void onConfirm()}>{pending ? 'Approving…' : 'Approve delivery'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
