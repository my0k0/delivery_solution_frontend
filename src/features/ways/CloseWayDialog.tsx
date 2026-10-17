import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermission } from '@/lib/auth/gate'
import { getApiErrorMessage } from '@/lib/api/client'
import { wayKeys, type Way } from '@/features/ways/api'
import { useQueryClient } from '@tanstack/react-query'

interface CloseWayDialogProps {
  way: Way
  onCloseWay: () => Promise<void>
}

export function CloseWayDialog({ way, onCloseWay }: CloseWayDialogProps) {
  const canCloseWay = usePermission('ways.update')
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  async function confirmClose() {
    setMessage('')
    setIsPending(true)
    try {
      await onCloseWay()
      setIsOpen(false)
      await queryClient.invalidateQueries({ queryKey: wayKeys.all })
    } catch (error) {
      setMessage(getApiErrorMessage(error))
    } finally {
      setIsPending(false)
    }
  }

  if (!canCloseWay || !way.isOpen) return null

  return (
    <>
      <Button variant="outline" className="min-h-10" onClick={() => setIsOpen(true)}>Close way</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this way?</DialogTitle>
            <DialogDescription>{way.riderName}’s way for {way.wayDate} will stop accepting new orders. Existing orders remain on this way.</DialogDescription>
          </DialogHeader>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setIsOpen(false)}>Keep open</Button>
            <Button type="button" className="min-h-10" disabled={isPending} onClick={() => void confirmClose()}>{isPending ? 'Closing…' : 'Close way'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
