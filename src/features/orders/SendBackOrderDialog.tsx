import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { Order } from '@/features/orders/api'
import { usePermission } from '@/lib/auth/usePermission'
import { FIELD_LIMITS } from '@/lib/constants'

interface SendBackOrderDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  onSave: (values: { reason: string; internalNote: string }) => Promise<void>
}

export function SendBackOrderDialog({ order, pending, onClose, onSave }: SendBackOrderDialogProps) {
  const canApproveDelivery = usePermission('deliveries.approve')
  const [reason, setReason] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave({ reason: reason.trim(), internalNote: internalNote.trim() })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send this order back.')
    }
  }
  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <DialogHeader><DialogTitle>Send order back</DialogTitle><DialogDescription>{order?.trackingCode} returns to the rider queue. Keep the shop reason separate from the internal note.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-2"><Label htmlFor="send-back-reason">Reason visible to shop</Label><Input id="send-back-reason" required maxLength={FIELD_LIMITS.order.reason} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="send-back-note">Internal note</Label><Input id="send-back-note" required maxLength={FIELD_LIMITS.order.internalNote} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Keep awaiting approval</Button>{canApproveDelivery && <Button type="submit" disabled={pending || !reason.trim() || !internalNote.trim()}>{pending ? 'Saving…' : 'Send back'}</Button>}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
