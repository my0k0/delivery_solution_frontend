import { z } from 'zod'
import { USER_STATUSES } from '@/lib/constants/user-status'
import { FIELD_LIMITS, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/constants'

const userBaseFields = {
  name: z
    .string()
    .min(1, 'Name is required')
    .max(FIELD_LIMITS.user.name, `Name must be at most ${FIELD_LIMITS.user.name} characters`),
  email: z.string().email('Enter a valid email'),
  // Runtime: "" | "09123456789" | null (codegen stubs phone as Record<string,never>|null).
  phone: z
    .string()
    .max(FIELD_LIMITS.user.phone, `Phone must be at most ${FIELD_LIMITS.user.phone} characters`)
    .nullable(),
  roleId: z.string().min(1, 'Select a role'),
  shopId: z.string().optional(),
}

const password = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  )
  .max(
    MAX_PASSWORD_LENGTH,
    `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
  )

/**
 * One schema for create and edit.
 *
 * These used to be two schemas over two value types, which forced the two-mode
 * branch and a cast at every access. They are now one `UserValues` shape with
 * both mode-specific keys always present, and each mode constrains only the key
 * it actually renders:
 *
 * - `password` — create renders it and requires the length rules; edit has no
 *   password field at all, so the value stays `''` and `toUpdateUserBody` omits
 *   it. Pinning it to `z.literal('')` in edit mode means a stale value can never
 *   sneak into a PATCH even if the field is rendered again later.
 * - `status` — edit renders it; create does not, and the backend defaults a new
 *   account to ACTIVE, so `toCreateUserBody` omits it. It stays required in the
 *   schema because the form always holds a valid default, which keeps the
 *   inferred type a plain `UserStatusValue` instead of `| undefined`.
 */
export function userSchema(isEditing: boolean) {
  return z.object({
    ...userBaseFields,
    password: isEditing ? z.literal('') : password,
    status: z.enum(USER_STATUSES),
  })
}

export type UserValues = z.infer<ReturnType<typeof userSchema>>
