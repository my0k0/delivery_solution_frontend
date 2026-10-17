import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { Order } from '@/features/orders/api'
import { usePermission } from '@/lib/auth/usePermission'
import { FIELD_LIMITS } from '@/lib/constants'

interface ReturnOrderDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  onSave: (reason: string) => Promise<void>
}

export function ReturnOrderDialog({ order, pending, onClose, onSave }: ReturnOrderDialogProps) {
  const canUpdateOrder = usePermission('orders.update')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave(reason.trim())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not return this order.')
    }
  }
  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <DialogHeader><DialogTitle>Return goods to shop</DialogTitle><DialogDescription>{order?.trackingCode} will be closed as returned. State why the package is back.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-2"><Label htmlFor="return-reason">Return reason</Label><Input id="return-reason" required maxLength={FIELD_LIMITS.order.reason} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Keep order</Button>{canUpdateOrder && <Button type="submit" disabled={pending || !reason.trim()}>{pending ? 'Saving…' : 'Mark returned'}</Button>}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
