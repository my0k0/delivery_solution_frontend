import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { subtractMoney } from '@/lib/money'
import { formatDecimalAmount } from '@/lib/utils'

interface OverpayConfirmDialogProps {
  riderName: string
  /** The rider's outstanding amount before this entry. */
  outstandingAmount: string
  /** The amount the officer is about to record. */
  amount: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * The one extra step before recording more than a rider owes.
 *
 * It is a confirmation rather than a refusal because a balance that moves the
 * wrong way is sometimes real: cash can arrive before the matching delivery is
 * approved, so the outstanding amount understates what the rider has handed
 * over. What it must not stay is silent, because the same arithmetic is how a
 * mistyped amount disappears — the balance simply reads lower, with no other
 * figure to contradict it.
 *
 * It names the numbers and what they leave behind, so the officer can tell the
 * two cases apart without leaving the dialog. It is mounted only while a
 * confirmation is pending, so there is no `open` to keep in step, and the
 * mutation stays in `HandoverDialog`, which owns it.
 */
export function OverpayConfirmDialog({
  riderName,
  outstandingAmount,
  amount,
  onCancel,
  onConfirm,
}: OverpayConfirmDialogProps) {
  const overBy = subtractMoney(amount, outstandingAmount)

  return (
    <AlertDialog open onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Record more than this rider owes?</AlertDialogTitle>
          <AlertDialogDescription>
            {riderName}’s outstanding amount is{' '}
            <span className="font-mono tabular-nums">
              {formatDecimalAmount(outstandingAmount)}
            </span>
            . Recording <span className="font-mono tabular-nums">{formatDecimalAmount(amount)}</span>{' '}
            leaves the company holding{' '}
            <span className="font-mono tabular-nums">{formatDecimalAmount(overBy)}</span>. Record it
            anyway?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Record handover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
