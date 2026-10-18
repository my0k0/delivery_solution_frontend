/**
 * The `field` vocabulary of `order_field_audit`, and how a row of it reads.
 *
 * The API resolves identifier values (`shopId`, `customerId`, `townshipId`,
 * `riderId`, `partnerId`) to the referenced record's name before they reach a
 * client, so nothing here looks an id up: this module only supplies a field's
 * label and the display form of the values the API leaves raw (booleans, money,
 * dates, free text).
 */

/** The fields `order_field_audit` records, mirroring the API's audited set. */
const ORDER_AUDIT_FIELDS = [
  'shopId',
  'customerId',
  'townshipId',
  'assigneeType',
  'riderId',
  'partnerId',
  'partnerTrackingNo',
  'packageInfo',
  'packagePrice',
  'deliveryFee',
  'commissionFee',
  'partnerFee',
  'isPackagePaidToShop',
  'isFeePaidToShop',
  'estimatedDeliveryDate',
  'deliveryAddress',
  'notes',
  'shopAdvanceAmount',
  'shopAdvancedAt',
] as const

type OrderAuditField = (typeof ORDER_AUDIT_FIELDS)[number]

/** A `Record` over the union, so forgetting a label is a compile error. */
const FIELD_LABELS: Record<OrderAuditField, string> = {
  shopId: 'Shop',
  customerId: 'Customer',
  townshipId: 'Township',
  assigneeType: 'Assignee type',
  riderId: 'Rider',
  partnerId: 'Delivery partner',
  partnerTrackingNo: 'Partner tracking number',
  packageInfo: 'Package information',
  packagePrice: 'Package price',
  deliveryFee: 'Delivery fee',
  commissionFee: 'Rider commission',
  partnerFee: 'Partner fee (internal)',
  isPackagePaidToShop: 'Package price paid to shop',
  isFeePaidToShop: 'Delivery fee paid to shop',
  estimatedDeliveryDate: 'Estimated delivery date',
  deliveryAddress: 'Delivery address',
  notes: 'Notes',
  shopAdvanceAmount: 'Shop advance',
  shopAdvancedAt: 'Shop advance recorded at',
}

/**
 * Fields whose stored value is a moment. `estimatedDeliveryDate` is a calendar
 * date held as a UTC-midnight instant, so only its date part is meaningful;
 * `shopAdvancedAt` is a real timestamp.
 */
const MOMENT_FIELDS = new Map<string, 'date' | 'datetime'>([
  ['estimatedDeliveryDate', 'date'],
  ['shopAdvancedAt', 'datetime'],
])

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/

function isOrderAuditField(field: string): field is OrderAuditField {
  return (ORDER_AUDIT_FIELDS as readonly string[]).includes(field)
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

export function orderFieldLabel(field: string): string {
  return isOrderAuditField(field) ? FIELD_LABELS[field] : humanizeFieldName(field)
}

export function orderAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return JSON.stringify(value) ?? '—'
  const moment = MOMENT_FIELDS.get(field)
  if (moment === 'date') {
    return ISO_DATE_PREFIX.test(value) ? value.slice(0, 10) : value
  }
  if (moment === 'datetime') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
  }
  return value
}
