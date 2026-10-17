import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Order } from '@/features/orders/api'
import { usePermission } from '@/lib/auth/usePermission'

interface MarkDeliveredDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function MarkDeliveredDialog({ order, pending, onClose, onConfirm }: MarkDeliveredDialogProps) {
  const canApproveDelivery = usePermission('deliveries.approve')
  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mark partner order delivered?</DialogTitle><DialogDescription>{order?.trackingCode} will be marked delivered now. Partner deliveries do not enter the rider approval queue.</DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Not yet</Button>{canApproveDelivery && <Button type="button" disabled={pending} onClick={() => void onConfirm()}>{pending ? 'Saving…' : 'Mark delivered'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
