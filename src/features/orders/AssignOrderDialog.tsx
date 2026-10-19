import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrderSelectField } from '@/features/orders/components/OrderSelectField'
import { useAssignableRiders } from '@/features/riders/api'
import { fetchDeliveryPartners, type Order } from '@/features/orders/api'
import { usePermission } from '@/lib/auth/usePermission'
import { getApiErrorMessage } from '@/lib/api/client'

interface AssignOrderDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  onSave: (value: { assigneeType: 'RIDER' | 'PARTNER' | null; assigneeId: string }) => Promise<void>
}

export function AssignOrderDialog({ order, pending, onClose, onSave }: AssignOrderDialogProps) {
  const canUpdateOrder = usePermission('orders.update')
  const [assigneeType, setAssigneeType] = useState<'RIDER' | 'PARTNER' | ''>('')
  const [assigneeId, setAssigneeId] = useState('')
  const [message, setMessage] = useState('')
  /**
   * Each list is fetched only once the user picks that type, so opening the
   * orders list costs no assignee requests at all. The rider list is the
   * dedicated `/riders/assignable` endpoint: only riders the office may assign.
   */
  const riders = useAssignableRiders({ enabled: assigneeType === 'RIDER' })
  const partners = useQuery({ queryKey: ['workflow-partners'], queryFn: fetchDeliveryPartners, enabled: assigneeType === 'PARTNER' })
  const riderOptions = (riders.data ?? []).map((rider) => ({ value: rider.id, label: rider.name }))
  const partnerOptions = (partners.data ?? []).filter((partner) => partner.isActive).map((partner) => ({ value: partner.id, label: partner.name }))
  /**
   * This dialog opens on `orders.update` and saves through
   * `POST /orders/{id}/assign` (also `orders.update`), but the two lists need
   * other grants: `/riders/assignable` requires `orders.create` and
   * `/delivery-partners` requires `partners.read`. Without this the picker just
   * renders empty and the user is told to "choose an assignee".
   */
  const riderError = riders.isError ? getApiErrorMessage(riders.error) : ''
  const partnerError = partners.isError ? getApiErrorMessage(partners.error) : ''
  const listError = assigneeType === 'RIDER' ? riderError : assigneeType === 'PARTNER' ? partnerError : ''

  async function submit() {
    if (assigneeType && !assigneeId) {
      setMessage('Choose an assignee, or choose Clear assignee.')
      return
    }
    setMessage('')
    try {
      await onSave({ assigneeType: assigneeType || null, assigneeId })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update the assignee.')
    }
  }

  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign order</DialogTitle>
          <DialogDescription>{order?.trackingCode} can be assigned to a rider, delivery partner, or nobody.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <OrderSelectField id="assignment-type" label="Assignment" value={assigneeType} options={[{ value: 'RIDER', label: 'Rider' }, { value: 'PARTNER', label: 'Delivery partner' }]} placeholder="Clear assignee" onChange={(value) => { setAssigneeType(value as 'RIDER' | 'PARTNER' | ''); setAssigneeId('') }} />
          {assigneeType && !listError && <OrderSelectField id="assignment-person" label={assigneeType === 'RIDER' ? 'Rider' : 'Delivery partner'} value={assigneeId} options={assigneeType === 'RIDER' ? riderOptions : partnerOptions} onChange={setAssigneeId} />}
        </div>
        {listError && (
          <p role="alert" className="text-sm text-destructive">
            {assigneeType === 'RIDER' ? 'Could not load assignable riders. ' : 'Could not load delivery partners. '}
            {listError}
          </p>
        )}
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          {canUpdateOrder && <Button type="button" disabled={pending || Boolean(listError)} onClick={() => void submit()}>{pending ? 'Saving…' : assigneeType ? 'Save assignment' : 'Clear assignee'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
