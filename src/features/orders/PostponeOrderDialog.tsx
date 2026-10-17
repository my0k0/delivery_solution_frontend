import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { Order } from '@/features/orders/api'
import { usePermission } from '@/lib/auth/usePermission'

interface PostponeOrderDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  onSave: (reason: string) => Promise<void>
}

export function PostponeOrderDialog({ order, pending, onClose, onSave }: PostponeOrderDialogProps) {
  const canUpdateOrder = usePermission('orders.update')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave(reason.trim())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not postpone this order.')
    }
  }
  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <DialogHeader><DialogTitle>Postpone delivery</DialogTitle><DialogDescription>{order?.trackingCode} will return to the pending queue. Give the shop a reason.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-2"><Label htmlFor="postpone-reason">Reason visible to shop</Label><Input id="postpone-reason" required minLength={1} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Keep assigned</Button>{canUpdateOrder && <Button type="submit" disabled={pending || !reason.trim()}>{pending ? 'Saving…' : 'Postpone order'}</Button>}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
