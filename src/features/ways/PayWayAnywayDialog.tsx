import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePermission } from '@/lib/auth/gate'
import { getApiErrorMessage } from '@/lib/api/client'
import { wayKeys, type Way } from '@/features/ways/api'
import { useQueryClient } from '@tanstack/react-query'

interface PayWayAnywayDialogProps {
  way: Way
  onPayAnyway: (reason: string) => Promise<void>
}

export function PayWayAnywayDialog({ way, onPayAnyway }: PayWayAnywayDialogProps) {
  const canPayAnyway = usePermission('ways.override_commission')
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  async function submit() {
    if (!reason.trim()) {
      setMessage('Enter a reason before paying anyway.')
      return
    }
    setMessage('')
    setIsPending(true)
    try {
      await onPayAnyway(reason.trim())
      setIsOpen(false)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: wayKeys.all })
    } catch (error) {
      setMessage(getApiErrorMessage(error))
    } finally {
      setIsPending(false)
    }
  }

  if (!canPayAnyway || way.state === 'EARNED' || way.state === 'PAID_ANYWAY') return null

  return (
    <>
      <Button variant="outline" className="min-h-10" onClick={() => setIsOpen(true)}>Pay anyway</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay commission anyway?</DialogTitle>
            <DialogDescription>This marks {way.riderName}’s way as paid without an approved delivery.</DialogDescription>
          </DialogHeader>
          <div role="alert" className="rounded-md border border-warning bg-warning/20 p-3 text-sm text-foreground">
            This action cannot be undone. The commission will be marked paid even though no order on this way has been approved.
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-anyway-reason">Reason (required)</Label>
            <Input id="pay-anyway-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" className="min-h-10" disabled={isPending || !reason.trim()} onClick={() => void submit()}>{isPending ? 'Paying…' : 'Confirm payment anyway'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
