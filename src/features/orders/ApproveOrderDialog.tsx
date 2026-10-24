import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api/client'
import { usePermission } from '@/lib/auth/usePermission'
import { fetchDeliveryProofs, orderKeys, type Order } from '@/features/orders/api'
import { DeliveryProofThumbnail } from '@/features/orders/DeliveryProofThumbnail'

interface ApproveOrderDialogProps {
  order: Order | null
  pending: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

/**
 * Approving is the moment a capture becomes evidence, so the officer sees the
 * photo here rather than discovering it afterwards. Nothing in this block can
 * block the approval: a partner delivery has no photo, and an expired link is a
 * reason to refresh, not a reason to strand the order.
 */
export function ApproveOrderDialog({ order, pending, onClose, onConfirm }: ApproveOrderDialogProps) {
  const canApproveDelivery = usePermission('deliveries.approve')
  const queryClient = useQueryClient()
  const orderId = order?.id
  const proofsQuery = useQuery({
    queryKey: orderKeys.proofs(orderId ?? ''),
    queryFn: () => (orderId ? fetchDeliveryProofs(orderId) : Promise.resolve([])),
    enabled: Boolean(orderId),
  })

  const proofs = proofsQuery.data ?? []
  // The accepted row wins if there is one; otherwise the newest capture is what
  // the officer is being asked to accept.
  const evidence = proofs.find((proof) => proof.approvedAt !== null) ?? proofs[0] ?? null

  function refreshEvidence() {
    if (!orderId) return
    void queryClient.invalidateQueries({ queryKey: orderKeys.proofs(orderId) })
  }

  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve delivered order?</DialogTitle><DialogDescription>Confirm delivery for {order?.trackingCode}. This confirms the delivery; it does not record cash received — the COD becomes expected back from the rider.</DialogDescription></DialogHeader>

        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {proofsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : evidence ? (
            <>
              <DeliveryProofThumbnail
                key={evidence.url}
                proof={evidence}
                alt={`Delivery photo captured for ${order?.trackingCode ?? 'this order'}`}
                onRetry={refreshEvidence}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Captured {new Date(evidence.capturedAt).toLocaleString()} by {evidence.uploadedByName}
                </p>
                <a href={evidence.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-4">View full size</a>
              </div>
            </>
          ) : proofsQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              The photo could not be loaded: {getApiErrorMessage(proofsQuery.error, 'the request failed.')}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No photo on this delivery</p>
          )}
        </div>

        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Review later</Button>{canApproveDelivery && <Button type="button" disabled={pending} onClick={() => void onConfirm()}>{pending ? 'Approving…' : 'Approve delivery'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
