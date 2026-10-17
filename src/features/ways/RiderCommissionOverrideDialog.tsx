import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Rider } from '@/features/riders/api'
import { usePermission } from '@/lib/auth/usePermission'
import { getApiErrorMessage } from '@/lib/api/client'
import { AMOUNT_PATTERN, COMMISSION_MAX_LENGTH } from '@/lib/constants'
import { toNullableString } from '@/lib/nullable'

interface RiderCommissionOverrideDialogProps {
  rider: Rider
  onSave: (value: string | null) => Promise<void>
}

export function RiderCommissionOverrideDialog({ rider, onSave }: RiderCommissionOverrideDialogProps) {
  const canOverrideCommission = usePermission('ways.override_commission')
  const canUpdateRiders = usePermission('riders.update')
  // Codegen stubs the nullable override as `Record<string, never> | null`.
  const currentOverride = toNullableString(rider.commissionPerWayOverride ?? null) ?? ''
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState(currentOverride)
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    if (value && !AMOUNT_PATTERN.test(value)) {
      setMessage('Enter a non-negative amount with up to two decimal places.')
      return
    }
    setMessage('')
    setIsPending(true)
    try {
      await onSave(value || null)
      setIsOpen(false)
    } catch (error) {
      setMessage(getApiErrorMessage(error))
    } finally {
      setIsPending(false)
    }
  }

  if (!canOverrideCommission || !canUpdateRiders) return null

  return (
    <>
      <Button variant="outline" className="min-h-10" onClick={() => { setValue(currentOverride); setMessage(''); setIsOpen(true) }}>Change override</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commission override for {rider.name}</DialogTitle>
            <DialogDescription>Leave this blank to use the current global per-way rate. Existing ways keep their saved rate.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`rider-commission-${rider.id}`}>Override per way (MMK)</Label>
            <Input id={`rider-commission-${rider.id}`} inputMode="decimal" maxLength={COMMISSION_MAX_LENGTH} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Use global rate" />
          </div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="button" className="min-h-10" disabled={isPending} onClick={() => void submit()}>{isPending ? 'Saving…' : 'Save override'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
