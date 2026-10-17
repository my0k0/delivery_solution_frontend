import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DeliveryPartnerForm } from '@/features/partners/DeliveryPartnerForm'
import type { DeliveryPartner, DeliveryPartnerBody } from '@/features/orders/api'

interface DeliveryPartnerDialogProps {
  partner: DeliveryPartner | null
  open: boolean
  pending: boolean
  onClose: () => void
  onSave: (body: DeliveryPartnerBody) => Promise<void>
}

export function DeliveryPartnerDialog({ partner, open, pending, onClose, onSave }: DeliveryPartnerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{partner ? 'Edit delivery partner' : 'Create delivery partner'}</DialogTitle><DialogDescription>Maintain delivery partner contact details and active status.</DialogDescription></DialogHeader>
        <DeliveryPartnerForm key={partner?.id ?? 'new-partner'} partner={partner} pending={pending} onCancel={onClose} onSave={onSave} />
      </DialogContent>
    </Dialog>
  )
}
