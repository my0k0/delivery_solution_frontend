import { z } from 'zod'
import { AMOUNT_PATTERN, FIELD_LIMITS } from '@/lib/constants'

export const townshipSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Township name is required')
    .max(
      FIELD_LIMITS.township.name,
      `Name must be at most ${FIELD_LIMITS.township.name} characters`,
    ),
  defaultDeliveryFee: z
    .string()
    .trim()
    .min(1, 'Delivery fee is required')
    .regex(AMOUNT_PATTERN, 'Enter a valid amount, e.g. 200 or 200.50'),
  /**
   * Required by `CreateTownshipDto`, mirroring `defaultDeliveryFee`. The rider
   * commission for an order prefills from here and is paid when the order is
   * approved as delivered.
   */
  defaultCommissionFee: z
    .string()
    .trim()
    .min(1, 'Commission fee is required')
    .regex(AMOUNT_PATTERN, 'Enter a valid amount, e.g. 500 or 500.50'),
  /**
   * Required by `CreateTownshipDto` (`@IsInt() @Min(0)`). Kept a string like the
   * money field, so the empty input fails instead of silently becoming `0`; the
   * request body converts with `Number()` at the boundary.
   */
  leadTimeDays: z
    .string()
    .trim()
    .min(1, 'Lead time is required')
    .regex(/^\d+$/, 'Enter the lead time in whole days (0 or more)')
    .refine((value) => Number.isSafeInteger(Number(value)), 'Lead time is too large'),
})

export type TownshipValues = z.infer<typeof townshipSchema>
