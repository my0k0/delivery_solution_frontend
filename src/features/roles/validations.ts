import { z } from 'zod'
import { FIELD_LIMITS, ROLE_NAME_PATTERN } from '@/lib/constants'

/** `@MaxLength(255)`; the API also allows null (and omit) to clear it. */
const description = z
  .string()
  .max(
    FIELD_LIMITS.role.description,
    `Description must be at most ${FIELD_LIMITS.role.description} characters`,
  )
  .nullable()

export const createRoleSchema = z.object({
  name: z.string().regex(
    ROLE_NAME_PATTERN,
    'Role name must be uppercase, 2-32 chars (letters, digits, underscore).',
  ),
  description,
})

export const updateRoleSchema = z.object({
  description,
})

export type CreateRoleValues = z.infer<typeof createRoleSchema>
export type UpdateRoleValues = z.infer<typeof updateRoleSchema>
