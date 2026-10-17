import { z } from 'zod'
import { FIELD_LIMITS } from '@/lib/constants'
import { CHANNEL_TYPES } from './channel-types'

/**
 * The single shop contract: one schema, one `ShopValues`, for both create and
 * edit.
 *
 * The previous pair (`createShopSchema` + `updateShopSchema`) differed only in
 * that every update field was `.optional()`. That could never buy anything at
 * runtime — the edit form is always seeded from the row and always submits
 * every field, so an "optional" field is present in practice and gets the exact
 * same validation as on create. It only cost a second schema and a second form
 * component, which is why `ShopDialog` had drifted to two near-identical 80-line
 * bodies that had to be kept in sync by hand.
 *
 * Optional fields are `string | null` rather than `string | undefined`: the
 * dialog owns an always-mounted `<input>` per field, so "user cleared it" has
 * to be representable. `''` is what the input actually holds; the dialog
 * normalises that to `null` at the request boundary.
 */
export const shopSchema = z.object({
  // Server has @IsString + @MaxLength(150) but NO @IsNotEmpty — empty string
  // passes validation and is stored. Enforce non-empty client-side.
  name: z
    .string()
    .min(1, 'Name is required')
    .max(FIELD_LIMITS.shop.name, `Name must be at most ${FIELD_LIMITS.shop.name} characters`),
  channelType: z.enum(CHANNEL_TYPES),
  channelName: z
    .string()
    .min(1, 'Channel name is required')
    .max(
      FIELD_LIMITS.shop.channelName,
      `Channel name must be at most ${FIELD_LIMITS.shop.channelName} characters`,
    ),
  phone: z
    .string()
    .max(FIELD_LIMITS.shop.phone, `Phone must be at most ${FIELD_LIMITS.shop.phone} characters`)
    .nullable(),
  address: z
    .string()
    .max(
      FIELD_LIMITS.shop.address,
      `Address must be at most ${FIELD_LIMITS.shop.address} characters`,
    )
    .nullable(),
  notes: z
    .string()
    .max(FIELD_LIMITS.shop.notes, `Notes must be at most ${FIELD_LIMITS.shop.notes} characters`)
    .nullable(),
})

export type ShopValues = z.infer<typeof shopSchema>
