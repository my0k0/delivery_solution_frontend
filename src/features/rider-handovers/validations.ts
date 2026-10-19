import { z } from 'zod'
import { AMOUNT_PATTERN, FIELD_LIMITS } from '@/lib/constants'
import { getTodayDate } from '@/features/reports/date-range'
import { HANDOVER_METHODS } from './handover-methods'

/**
 * One schema for both modes, and the mode difference lives in a refinement
 * rather than in the shape: react-hook-form types its resolver against one value
 * type, so two schemas with different key sets cannot both drive one form
 * without a cast.
 *
 * `reason` is therefore always a `string`, never `.optional()` — blank in create
 * mode and required in edit mode — so the request body needs no `?? null` on a
 * field the form cannot leave absent.
 *
 * The future-date rule is checked here as well as in the API because the API's
 * day is the office's day, not the browser's; this is the fast path, and a
 * server 400 remains the authority. `''` compares as less than every date, so an
 * untouched field does not trip it.
 */
export function handoverSchema(isEditing: boolean) {
  return z
    .object({
      /**
       * Seeded from the balances row on create, where the rider is not a choice,
       * and editable on a correction — a handover recorded against the wrong
       * rider has to be fixable.
       */
      riderId: z.string().min(1, 'Choose a rider'),
      amount: z.string().regex(AMOUNT_PATTERN, 'Enter an amount like 12000.00'),
      receivedOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date as YYYY-MM-DD'),
      method: z.enum(HANDOVER_METHODS),
      note: z
        .string()
        .max(
          FIELD_LIMITS.handover.note,
          `Note must be at most ${FIELD_LIMITS.handover.note} characters`,
        ),
      reason: z
        .string()
        .max(
          FIELD_LIMITS.handover.reason,
          `Reason must be at most ${FIELD_LIMITS.handover.reason} characters`,
        ),
    })
    .superRefine((values, ctx) => {
      if (values.receivedOn > getTodayDate()) {
        ctx.addIssue({
          code: 'custom',
          path: ['receivedOn'],
          message: 'The received date cannot be in the future',
        })
      }
      if (isEditing && values.reason.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['reason'],
          message: 'A reason is required to correct a handover',
        })
      }
    })
}

export type HandoverValues = z.infer<ReturnType<typeof handoverSchema>>
