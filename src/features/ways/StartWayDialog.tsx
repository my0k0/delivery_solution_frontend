import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { fetchRiders, ridersKeys } from '@/features/riders/api'
import { usePermission } from '@/lib/auth/usePermission'
import { getApiErrorMessage } from '@/lib/api/client'
import { wayKeys, type CreateWayBody } from '@/features/ways/api'

interface StartWayDialogProps {
  onSave: (body: CreateWayBody) => Promise<void>
}

export function StartWayDialog({ onSave }: StartWayDialogProps) {
  const canStartWay = usePermission('ways.create')
  const [isOpen, setIsOpen] = useState(false)
  const [riderId, setRiderId] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()
  const riders = useQuery({
    queryKey: ridersKeys.list({ page: 1, perPage: 100, status: 'ACTIVE' }),
    queryFn: () => fetchRiders({ page: 1, perPage: 100, status: 'ACTIVE' }),
    enabled: isOpen && canStartWay,
  })

  async function submit() {
    if (!riderId) {
      setMessage('Choose a rider to start a way.')
      return
    }
    setMessage('')
    setIsPending(true)
    try {
      await onSave({ riderId })
      setIsOpen(false)
      setRiderId('')
      await queryClient.invalidateQueries({ queryKey: wayKeys.all })
    } catch (error) {
      setMessage(getApiErrorMessage(error))
    } finally {
      setIsPending(false)
    }
  }

  if (!canStartWay) return null

  return (
    <>
      <Button className="min-h-10" onClick={() => setIsOpen(true)}>Start new way</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new way</DialogTitle>
            <DialogDescription>Starting a way closes this rider’s current open way for today. New rider assignments will join the new way.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="start-way-rider">Rider</Label>
            <select
              id="start-way-rider"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              value={riderId}
              onChange={(event) => setRiderId(event.target.value)}
              disabled={riders.isLoading || riders.isError}
            >
              <option value="">Choose a rider</option>
              {(riders.data?.data ?? []).map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
            </select>
            {riders.isError && <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(riders.error)}</p>}
          </div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="button" className="min-h-10" disabled={isPending || riders.isLoading || !riderId} onClick={() => void submit()}>{isPending ? 'Starting…' : 'Start way'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
