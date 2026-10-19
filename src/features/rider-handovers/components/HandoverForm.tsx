import { useFormContext } from 'react-hook-form'
import { SelectField, type SelectOption } from '@/components/form/SelectField'
import { TextField } from '@/components/form/TextField'
import { FIELD_LIMITS } from '@/lib/constants'
import { formatDecimalAmount } from '@/lib/utils'
import { HANDOVER_METHOD_OPTIONS } from '../handover-methods'
import type { HandoverValues } from '../validations'

export interface HandoverAmountPreview {
  /** The rider's outstanding balance before this entry. */
  currentBalance: string
  /** What it becomes if the entered amount is recorded. */
  afterBalance: string
}

interface HandoverFormFieldsProps {
  isEditing: boolean
  /** The fixed rider in create mode: recording always starts from that rider's row. */
  riderName: string
  /** Edit mode only — a correction is where a wrong rider gets fixed. */
  riderOptions: readonly SelectOption[]
  /** True when the rider list stopped at the API's page cap and may not cover every rider. */
  isRiderListTruncated: boolean
  preview?: HandoverAmountPreview
}

/**
 * The fields of the record/correct handover form, and nothing else. It reads
 * `register`/`control`/`errors` from context, so the only props are the things it
 * cannot derive: the mode, the rider (fixed on create, a choice on edit), and a
 * preview the dialog computes.
 */
export function HandoverFormFields({
  isEditing,
  riderName,
  riderOptions,
  isRiderListTruncated,
  preview,
}: HandoverFormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<HandoverValues>()

  const isOverpaying = preview !== undefined && preview.afterBalance.startsWith('-')

  return (
    <>
      {isEditing ? (
        <>
          <SelectField
            control={control}
            name="riderId"
            htmlFor="handover-rider"
            label="Rider"
            options={riderOptions}
            placeholder="Choose a rider"
            required
            error={errors.riderId?.message}
          />
          {isRiderListTruncated && (
            <p className="text-xs text-muted-foreground">
              Showing the first {riderOptions.length} riders. For anyone else, go back to the
              balances list and correct the handover from their row.
            </p>
          )}
        </>
      ) : (
        // Recording starts from a rider's row, so the rider is not a choice here:
        // the outstanding amount this dialog checks against is that row's rider's.
        // A handover filed against the wrong rider is fixed by correcting it.
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-none">Rider</span>
          <p className="text-sm">{riderName}</p>
        </div>
      )}

      <TextField
        {...register('amount')}
        htmlFor="handover-amount"
        label="Amount received"
        inputMode="decimal"
        placeholder="e.g. 12000 or 12000.50"
        required
        error={errors.amount?.message}
      />
      {preview && (
        // Announced, because the officer is the one who knows whether a balance
        // that moves the wrong way is a real handover or a typo. It says what
        // happens next, since an amount above the balance is not blocked — it
        // asks for a confirmation.
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Outstanding amount {formatDecimalAmount(preview.currentBalance)} →{' '}
          {formatDecimalAmount(preview.afterBalance)}
          {isOverpaying && ' — more than this rider owes, so saving will ask you to confirm'}
        </p>
      )}

      <TextField
        {...register('receivedOn')}
        htmlFor="handover-received-on"
        label="Received on"
        type="date"
        required
        error={errors.receivedOn?.message}
      />

      <SelectField
        control={control}
        name="method"
        htmlFor="handover-method"
        label="Received by"
        options={HANDOVER_METHOD_OPTIONS}
        required
        error={errors.method?.message}
      />

      <TextField
        {...register('note')}
        htmlFor="handover-note"
        label="Note"
        maxLength={FIELD_LIMITS.handover.note}
        placeholder="KPay reference, or anything worth remembering"
        error={errors.note?.message}
      />

      {isEditing && (
        <TextField
          {...register('reason')}
          htmlFor="handover-reason"
          label="Reason for the correction"
          maxLength={FIELD_LIMITS.handover.reason}
          placeholder="Why this handover is being changed"
          required
          error={errors.reason?.message}
        />
      )}
    </>
  )
}
