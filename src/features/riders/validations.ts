import { z } from 'zod'
import { FIELD_LIMITS, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/constants'
import { USER_STATUSES } from '@/lib/constants/user-status'
import { VEHICLE_TYPES } from './vehicle-types'

/** Fields that exist in both modes. */
const riderProfileFields = {
  name: z
    .string()
    .min(1, 'Name is required')
    .max(FIELD_LIMITS.rider.name, `Name must be at most ${FIELD_LIMITS.rider.name} characters`),
  phone: z
    .string()
    .max(FIELD_LIMITS.rider.phone, `Phone must be at most ${FIELD_LIMITS.rider.phone} characters`)
    .nullable(),
  status: z.enum(USER_STATUSES),
  licenseNo: z
    .string()
    .max(
      FIELD_LIMITS.rider.licenseNo,
      `License number must be at most ${FIELD_LIMITS.rider.licenseNo} characters`,
    )
    .nullable(),
  vehicleType: z.enum(VEHICLE_TYPES),
  vehiclePlate: z
    .string()
    .max(
      FIELD_LIMITS.rider.vehiclePlate,
      `Vehicle plate must be at most ${FIELD_LIMITS.rider.vehiclePlate} characters`,
    )
    .nullable(),
  nrcNumber: z
    .string()
    .max(
      FIELD_LIMITS.rider.nrcNumber,
      `NRC number must be at most ${FIELD_LIMITS.rider.nrcNumber} characters`,
    )
    .nullable(),
  emergencyContactPhone: z
    .string()
    .max(
      FIELD_LIMITS.rider.emergencyContactPhone,
      `Emergency contact phone must be at most ${FIELD_LIMITS.rider.emergencyContactPhone} characters`,
    )
    .nullable(),
  notes: z
    .string()
    .max(FIELD_LIMITS.rider.notes, `Notes must be at most ${FIELD_LIMITS.rider.notes} characters`)
    .nullable(),
}

/**
 * One schema for both modes — `requiresAccount` is the only thing that differs.
 *
 * This used to be a `createRiderSchema` / `updateRiderSchema` pair, and keeping
 * them unified is what makes a single `useForm` possible: react-hook-form types
 * the resolver against the form's value type, so two schemas with different
 * key sets (or different optionality) cannot both be passed to one form without
 * a cast. Deriving the second schema from the first only moved the problem to
 * the value types, so the mode difference is expressed where it actually lives —
 * in a refinement — rather than in the shape.
 *
 * Create provisions a backing user row, so it needs credentials. Update is one
 * combined PATCH against an existing account: the email is read-only in the UI
 * and credentials are never sent. Defaults for status/vehicleType
 * mirror CreateRiderDto (@default ACTIVE / BIKE) rather than being
 * invented here.
 *
 * Format and length are validated unconditionally (they are free to check, and
 * a blank string is accepted so the field is not permanently red while the user
 * is still typing); only *presence* is mode-dependent.
 */
export function riderSchema(requiresAccount: boolean) {
  return z
    .object({
      ...riderProfileFields,
      email: z.union([
        // 255 is client-side only: the API types email as @IsEmail with no max.
        z.literal(''),
        z.string().email('Enter a valid email').max(255, 'Email must be at most 255 characters'),
      ]),
      password: z.union([
        z.literal(''),
        z
          .string()
          .min(
            MIN_PASSWORD_LENGTH,
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          )
          .max(
            MAX_PASSWORD_LENGTH,
            `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
          ),
      ]),
    })
    .superRefine((values, ctx) => {
      if (!requiresAccount) return
      if (values.email === '') {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email is required' })
      }
      if (values.password === '') {
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password is required' })
      }
    })
}

/**
 * The form's state type. `email`/`password` are always present as strings (blank
 * in edit mode, where the account block is read-only and the PATCH omits them).
 */
export type RiderValues = z.infer<ReturnType<typeof riderSchema>>
