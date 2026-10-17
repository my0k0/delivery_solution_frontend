import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { usePermission } from '@/lib/auth/gate'
import { getApiErrorMessage } from '@/lib/api/client'
import { wayKeys, type Way, type WayOrder } from '@/features/ways/api'
import { useQueryClient } from '@tanstack/react-query'

interface MoveWayOrdersDialogProps {
  way: Way
  orders: WayOrder[]
  targetWays: Way[]
  onMove: (orderIds: string[], targetWayId: string) => Promise<void>
}

export function MoveWayOrdersDialog({ way, orders, targetWays, onMove }: MoveWayOrdersDialogProps) {
  const canMoveOrders = usePermission('ways.update')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [targetWayId, setTargetWayId] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()
  const movableOrders = orders.filter((order) => order.status === 'ASSIGNED' || order.status === 'AWAITING_APPROVAL')
  const sameRiderWays = targetWays.filter((targetWay) => targetWay.riderId === way.riderId && targetWay.id !== way.id)

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((current) => current.includes(orderId)
      ? current.filter((selectedOrderId) => selectedOrderId !== orderId)
      : [...current, orderId])
  }

  async function submit() {
    if (!selectedOrderIds.length || !targetWayId) {
      setMessage('Select at least one order and a target way.')
      return
    }
    setMessage('')
    setIsPending(true)
    try {
      await onMove(selectedOrderIds, targetWayId)
      setIsOpen(false)
      setSelectedOrderIds([])
      setTargetWayId('')
      await queryClient.invalidateQueries({ queryKey: wayKeys.all })
    } catch (error) {
      setMessage(getApiErrorMessage(error))
    } finally {
      setIsPending(false)
    }
  }

  if (!canMoveOrders || !movableOrders.length || !sameRiderWays.length) return null

  return (
    <>
      <Button variant="outline" className="min-h-10" onClick={() => setIsOpen(true)}>Move orders</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Move orders to another way</DialogTitle>
            <DialogDescription>Only assigned or awaiting-approval orders can move. The target must belong to {way.riderName}.</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Orders to move</legend>
            {movableOrders.map((order) => (
              <label key={order.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={selectedOrderIds.includes(order.id)} onChange={() => toggleOrder(order.id)} className="size-4 accent-primary" />
                <span className="font-mono">{order.trackingCode}</span>
                <span className="text-muted-foreground">{order.status.replaceAll('_', ' ')}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor="move-orders-target">Target way</Label>
            <select
              id="move-orders-target"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={targetWayId}
              onChange={(event) => setTargetWayId(event.target.value)}
            >
              <option value="">Choose a way</option>
              {sameRiderWays.map((targetWay) => <option key={targetWay.id} value={targetWay.id}>{targetWay.wayDate} · {targetWay.sequence}{targetWay.isOpen ? ' · Open' : ' · Closed'}</option>)}
            </select>
          </div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="button" className="min-h-10" disabled={isPending || !selectedOrderIds.length || !targetWayId} onClick={() => void submit()}>{isPending ? 'Moving…' : 'Move selected orders'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
