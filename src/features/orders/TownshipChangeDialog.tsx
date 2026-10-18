import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Township } from '@/features/orders/api'

interface TownshipChangeDialogProps {
  open: boolean
  township: Township | null
  canApplyDefaults: boolean
  onClose: () => void
  onChoose: (overwriteDefaults: boolean) => void
}

export function TownshipChangeDialog({ open, township, canApplyDefaults, onClose, onChoose }: TownshipChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change township?</DialogTitle>
          <DialogDescription>
            {township
              ? `${township.name} has a default fee of ${township.defaultDeliveryFee} and a lead time of ${township.leadTimeDays} days. Choose whether to replace the current delivery fee and commission.`
              : 'The current delivery fee, commission and assignee will be kept.'}
          </DialogDescription>
        </DialogHeader>
        {township ? (
          <>
            {!canApplyDefaults && <p className="text-sm text-muted-foreground">Your role can keep the current fee and commission, but cannot apply cost defaults.</p>}
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onChoose(false)}>
                Keep current fee and commission
              </Button>
              <Button type="button" disabled={!canApplyDefaults} onClick={() => onChoose(true)}>
                Apply township defaults
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => onChoose(false)}>
              Remove township
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
