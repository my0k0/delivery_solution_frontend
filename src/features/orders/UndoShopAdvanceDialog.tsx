import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { Order } from '@/features/orders/api'
import { FIELD_LIMITS } from '@/lib/constants'

interface UndoShopAdvanceDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  /** `reason` is defined only when the order is DELIVERED, where the API requires one. */
  onSave: (reason: string | undefined) => Promise<void>
}

export function UndoShopAdvanceDialog({ order, pending, onClose, onSave }: UndoShopAdvanceDialogProps) {
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const requiresReason = order?.status === 'DELIVERED'
  const advancedAt = order?.shopAdvancedAt ? new Date(order.shopAdvancedAt).toLocaleString() : ''

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave(requiresReason ? reason.trim() : undefined)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not clear this advance.')
    }
  }

  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>Clear recorded advance?</DialogTitle>
            <DialogDescription>
              {order?.trackingCode}: removes the recorded advance of {order?.shopAdvanceAmount}
              {advancedAt ? ` paid on ${advancedAt}` : ''}, so the order counts as unadvanced again. Use this only to
              correct a mistake.
            </DialogDescription>
          </DialogHeader>
          {requiresReason && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="undo-advance-reason">Reason (required — this order is delivered)</Label>
              <Input
                id="undo-advance-reason"
                required
                maxLength={FIELD_LIMITS.order.reason}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          )}
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Keep advance</Button>
            <Button type="submit" variant="destructive" disabled={pending || (requiresReason && !reason.trim())}>
              {pending ? 'Saving…' : 'Clear advance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
