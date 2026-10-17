import { useFormContext } from 'react-hook-form'
import { TextField } from '@/components/form/TextField'
import { FIELD_LIMITS } from '@/lib/constants'
import type { TownshipValues } from '../validations'

export function TownshipFormFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<TownshipValues>()

  return (
    <>
      <TextField
        {...register('name')}
        htmlFor="township-name"
        label="Township name"
        maxLength={FIELD_LIMITS.township.name}
        required
        error={errors.name?.message}
      />
      <TextField
        {...register('defaultDeliveryFee')}
        htmlFor="township-default-fee"
        label="Delivery fee"
        inputMode="decimal"
        placeholder="e.g. 200 or 200.50"
        required
        error={errors.defaultDeliveryFee?.message}
      />
      <TextField
        {...register('leadTimeDays')}
        htmlFor="township-lead-time"
        label="Lead time (days)"
        inputMode="numeric"
        placeholder="e.g. 3"
        required
        error={errors.leadTimeDays?.message}
      />
    </>
  )
}
