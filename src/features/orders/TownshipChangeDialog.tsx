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
              ? `${township.name} has a default fee of ${township.defaultDeliveryFee} and a lead time of ${township.leadTimeDays} days. Choose whether to replace the current fee and assignee.`
              : 'There are no township defaults to apply. Choose whether to keep the current assignee or clear it; the current fee will be kept.'}
          </DialogDescription>
        </DialogHeader>
        {!canApplyDefaults && <p className="text-sm text-muted-foreground">Your role can keep the current fee and assignee, but cannot apply cost defaults.</p>}
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onChoose(false)}>
            Keep current fee and assignee
          </Button>
          <Button type="button" disabled={!canApplyDefaults} onClick={() => onChoose(true)}>
            {township ? 'Apply township defaults' : 'Remove township and clear assignee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
