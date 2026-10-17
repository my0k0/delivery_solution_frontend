/** Role name: uppercase, 2-32 chars, letters/digits/underscore (backend-enforced). */
export const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,31}$/

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72

/**
 * Money input accepted by the API: up to 10 whole units with an optional 1-2
 * decimals, e.g. `200`, `200.5`, `200.00`. One source of truth for every amount
 * field (township default fee, order package price/delivery fee/partner fee,
 * commission rate and rider override).
 *
 * Matches `MONEY_PATTERN` in the API's order, commission and rider DTOs: up to
 * 10 integer digits with an optional 1-2 decimals, e.g. `200`, `200.5`,
 * `200.00`. The cap is the real one — the `numeric(12,2)` columns behind these
 * fields hold 10 integer digits, so anything longer is a database error.
 */
export const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/

/**
 * `maxLength` for the two commission inputs — the longest string AMOUNT_PATTERN
 * accepts (10 integer digits + `.` + 2 decimals). Purely a typing cap; the
 * pattern is what rejects an over-long value.
 */
export const COMMISSION_MAX_LENGTH = 13

/**
 * Length limits the API enforces (`@MaxLength` on the request DTOs).
 *
 * These mirror `delivery_solution_api`, not the UI: a value longer than the server's limit is a
 * 400 after the user has typed the whole thing, so the client has to stop it
 * first. They used to be magic numbers inside each feature's zod schema, which
 * is how they drifted — `shops.channelName` allowed 200 against a DTO limit of
 * 100, and `users.name`, `users.phone` and `roles.description` had no cap at
 * all, so the API rejected what the form accepted.
 *
 * Source of truth: `../delivery_solution_api/src/<feature>/dto/*.dto.ts`.
 * Nothing checks these against the DTOs automatically; change both together.
 */
export const FIELD_LIMITS = {
  shop: { name: 150, channelName: 100, phone: 30, address: 500, notes: 500 },
  customer: { name: 150, phone: 30, address: 500, notes: 500 },
  rider: {
    name: 100,
    phone: 20,
    licenseNo: 50,
    vehiclePlate: 30,
    nrcNumber: 50,
    emergencyContactPhone: 30,
    notes: 500,
  },
  user: { name: 100, phone: 20 },
  role: { description: 255 },
  township: { name: 120 },
  partner: { name: 120, phone: 30, note: 1000 },
  order: {
    deliveryAddress: 2000,
    notes: 2000,
    partnerTrackingNo: 200,
    reason: 1000,
    internalNote: 2000,
  },
  way: { payAnywayReason: 1000 },
} as const
