import { isMoneyString } from '@/lib/money'
import { formatDecimalAmount } from '@/lib/utils'
import { handoverMethodLabel, isHandoverMethod } from './handover-methods'

/**
 * The `field` vocabulary of `rider_handover_audit`, and how a row of it reads.
 *
 * The API resolves a `riderId` change to the rider's name before it reaches a
 * client, so nothing here looks an id up: this module supplies a field's label
 * and the display form of the values the API leaves raw.
 *
 * Mirrors `features/orders/audit-fields.ts`, with one deliberate difference:
 * money and the method are formatted here. The trail sits directly under a table
 * of thousands-separated figures, so a correction reading `100000 → 120000` next
 * to a row reading `120,000.00` is two spellings of one amount on one screen.
 * The audit stores what it was given — a typed `120000` stays `120000` while the
 * row's own `120000.00` comes back from Postgres — which is exactly why the
 * formatting belongs at display time, where the amount is known to be money.
 */

/** The fields the API audits, mirroring `AUDITED_FIELDS` in the service. */
const HANDOVER_AUDIT_FIELDS = [
  'riderId',
  'amount',
  'receivedOn',
  'method',
  'note',
] as const

type HandoverAuditField = (typeof HANDOVER_AUDIT_FIELDS)[number]

/** Typed over the union, so forgetting a label is a compile error, not a blank cell. */
const FIELD_LABELS: Record<HandoverAuditField, string> = {
  riderId: 'Rider',
  amount: 'Amount',
  receivedOn: 'Received on',
  method: 'Received by',
  note: 'Note',
}

function isHandoverAuditField(field: string): field is HandoverAuditField {
  return (HANDOVER_AUDIT_FIELDS as readonly string[]).includes(field)
}

/**
 * A field the API adds before this mirror learns about it still reads as words
 * rather than as a database column name.
 */
function humanizeFieldName(field: string): string {
  const words = field
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function handoverFieldLabel(field: string): string {
  return isHandoverAuditField(field) ? FIELD_LABELS[field] : humanizeFieldName(field)
}

/**
 * How one stored value reads.
 *
 * `old_value`/`new_value` are `jsonb`, so what arrives is whatever JSON held: a
 * string, a number, a boolean or null. Each shape is narrowed rather than
 * assumed, and anything that is not an amount keeps its own spelling.
 */
export function handoverAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (field === 'amount' && typeof value === 'number') {
    return formatDecimalAmount(String(value))
  }
  if (typeof value === 'string') {
    if (field === 'amount' && isMoneyString(value)) return formatDecimalAmount(value)
    if (field === 'method' && isHandoverMethod(value)) return handoverMethodLabel(value)
    return value
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  return JSON.stringify(value)
}
