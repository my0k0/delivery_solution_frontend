import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Form, FormBody, FormFooter } from '@/components/form/Form'
import { FormAlert } from '@/components/form/FormAlert'
import type { SelectOption } from '@/components/form/SelectField'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRiders, RIDER_LIST_MAX_PER_PAGE } from '@/features/riders/api'
import { getApiErrorMessage } from '@/lib/api/client'
import { AMOUNT_PATTERN } from '@/lib/constants'
import { isMoreMoneyThan, subtractMoney } from '@/lib/money'
import {
  useSaveRiderHandover,
  type RiderHandover,
  type RiderHandoverBalance,
} from '../api'
import {
  toCreateRiderHandoverBody,
  toHandoverFormValues,
  toNewHandoverFormValues,
  toUpdateRiderHandoverBody,
} from '../mappers'
import { handoverSchema, type HandoverValues } from '../validations'
import { HandoverFormFields, type HandoverAmountPreview } from './HandoverForm'
import { OverpayConfirmDialog } from './OverpayConfirmDialog'

interface HandoverDialogProps {
  open: boolean
  /** The handover being corrected; absent means a new record. */
  handover?: RiderHandover
  /**
   * The balances row a new record belongs to. Recording starts from a rider's
   * row, so a create without one has no rider and no outstanding amount to
   * check the entry against.
   */
  sourceRow?: RiderHandoverBalance
  onClose: () => void
}

/**
 * One dialog for both recording and correcting, the way the API is one row for
 * both: the fields are the same and only the reason differs.
 *
 * The balance preview is create-only. A correction replaces an amount the
 * balance already contains, so `balance − newAmount` would understate what the
 * rider still owes; the honest figure needs the old amount too, and the row being
 * corrected does not carry the balance it belongs to.
 *
 * Recording more than the rider owes is not refused, it is confirmed: the amount
 * is real when cash arrives before the matching delivery is approved, and it is
 * how a mistyped figure hides when it is not. The confirmation names both numbers
 * and the balance they leave behind, then this dialog runs the same mutation it
 * would have run directly.
 *
 * A correction with nothing changed is not sendable: the save button stays
 * disabled until the form differs from the row it opened with, rather than making
 * the round trip whose only answer is "Nothing changed". `isDirty` compares
 * against the row's own values, so re-typing the same figure is not a change —
 * though re-spelling it (`120000` for `120000.00`) reads as one, and the API's
 * normalised comparison stays the authority for that, surfacing in the alert.
 */
export function HandoverDialog({ open, handover, sourceRow, onClose }: HandoverDialogProps) {
  const isEditing = handover !== undefined
  const formValues = useMemo(
    () => (handover ? toHandoverFormValues(handover) : toNewHandoverFormValues(sourceRow?.riderId)),
    [handover, sourceRow],
  )
  const form = useForm<HandoverValues>({
    resolver: zodResolver(handoverSchema(isEditing)),
    defaultValues: formValues,
    values: formValues,
  })
  const saveHandoverMutation = useSaveRiderHandover()
  // Deliberately not filtered by status: a rider who has left can still owe
  // money, and this dialog is where it gets settled. The rider is a choice only
  // on a correction; a new record takes it from the row it was opened from.
  const riders = useRiders({ page: 1, perPage: RIDER_LIST_MAX_PER_PAGE })
  const [pendingOverpay, setPendingOverpay] = useState<HandoverValues>()
  const {
    errors,
    isDirty,
  } = form.formState
  const amount = form.watch('amount')

  /**
   * Edit mode only — a new record takes its rider from the row it opened from.
   * Base UI resolves the trigger's label from the options map, so a current value
   * that is missing from them renders as a raw id. The rider list is capped and
   * the rider on this row may not be in it, so the row's own rider is merged in.
   */
  const riderOptions = useMemo<SelectOption[]>(() => {
    if (handover === undefined) return []
    const options = (riders.data?.data ?? []).map((rider) => ({
      value: rider.id,
      label: rider.name,
    }))
    if (!options.some((option) => option.value === handover.riderId)) {
      options.unshift({ value: handover.riderId, label: handover.riderName })
    }
    return options
  }, [riders.data, handover])

  const amountPreview = useMemo<HandoverAmountPreview | undefined>(() => {
    if (isEditing || sourceRow === undefined || !AMOUNT_PATTERN.test(amount)) return undefined
    return {
      currentBalance: sourceRow.balance,
      afterBalance: subtractMoney(sourceRow.balance, amount),
    }
  }, [isEditing, sourceRow, amount])

  function handleClose() {
    setPendingOverpay(undefined)
    form.reset(formValues)
    form.clearErrors()
    onClose()
  }

  async function saveHandover(values: HandoverValues) {
    form.clearErrors('root')
    try {
      await saveHandoverMutation.mutateAsync(
        handover
          ? { id: handover.id, body: toUpdateRiderHandoverBody(values) }
          : { body: toCreateRiderHandoverBody(values) },
      )
      toast.success(isEditing ? 'Handover corrected' : 'Handover recorded')
      handleClose()
    } catch (error) {
      form.setError('root', { message: getApiErrorMessage(error) })
    }
  }

  function onValid(values: HandoverValues) {
    // Only a new record is checked: a correction already carries a required
    // reason, and the figure it replaces is part of the balance it is compared
    // against, so the same comparison would be wrong there.
    if (!isEditing && sourceRow && isMoreMoneyThan(values.amount, sourceRow.balance)) {
      setPendingOverpay(values)
      return
    }
    void saveHandover(values)
  }

  function handleConfirmOverpay() {
    // Read before clearing: the alert closes into the form, which owns the
    // mutation and shows its own pending and error state.
    const values = pendingOverpay
    setPendingOverpay(undefined)
    if (values) void saveHandover(values)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <Form form={form} onValid={onValid}>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Correct handover' : 'Record handover'}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? 'Every field stays editable and the change is kept with your name and a reason.'
                  : 'Cash this rider has handed back. It settles against everything they have delivered, not against one order.'}
              </DialogDescription>
            </DialogHeader>

            <FormBody>
              <HandoverFormFields
                isEditing={isEditing}
                riderName={handover?.riderName ?? sourceRow?.riderName ?? ''}
                riderOptions={riderOptions}
                isRiderListTruncated={(riders.data?.meta.totalPages ?? 1) > 1}
                preview={amountPreview}
              />
              {isEditing && !isDirty && (
                // The save button is disabled while the form matches the row it
                // came from; without this the officer is left guessing why.
                <p className="text-xs text-muted-foreground">
                  Edit a field to save a correction.
                </p>
              )}
            </FormBody>

            <FormAlert error={errors.root?.message} />

            <FormFooter
              submitLabel={isEditing ? 'Save correction' : 'Record handover'}
              isSubmitting={saveHandoverMutation.isPending}
              isSubmitDisabled={isEditing && !isDirty}
            />
          </Form>
        </DialogContent>
      </Dialog>

      {pendingOverpay && sourceRow && (
        <OverpayConfirmDialog
          riderName={sourceRow.riderName}
          outstandingAmount={sourceRow.balance}
          amount={pendingOverpay.amount}
          onCancel={() => setPendingOverpay(undefined)}
          onConfirm={handleConfirmOverpay}
        />
      )}
    </>
  )
}
