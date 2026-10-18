import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { Order } from '@/features/orders/api'
import { FIELD_LIMITS } from '@/lib/constants'

interface RecordShopAdvanceDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  /** `reason` is defined only when the order is DELIVERED, where the API requires one. */
  onSave: (reason: string | undefined) => Promise<void>
}

export function RecordShopAdvanceDialog({ order, pending, onClose, onSave }: RecordShopAdvanceDialogProps) {
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const requiresReason = order?.status === 'DELIVERED'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave(requiresReason ? reason.trim() : undefined)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record this advance.')
    }
  }

  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>Record advance to shop?</DialogTitle>
            <DialogDescription>
              {order?.trackingCode}: the company pays the shop the package price of {order?.packagePrice}. This
              reduces what the company still owes for this order.
            </DialogDescription>
          </DialogHeader>
          {requiresReason && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="record-advance-reason">Reason (required — this order is delivered)</Label>
              <Input
                id="record-advance-reason"
                required
                maxLength={FIELD_LIMITS.order.reason}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          )}
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending || (requiresReason && !reason.trim())}>
              {pending ? 'Saving…' : 'Record advance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
