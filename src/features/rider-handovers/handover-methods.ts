/**
 * How a rider's cash reached the office.
 *
 * One tuple is the source: the derived union feeds `z.enum(...)` directly, so a
 * rename in the API's `handover_method` enum is a compile error here rather than
 * a validation hole that lets a bad value through to a 400.
 *
 * `KPAY` is first and is the default because it is how nearly all of this money
 * moves; in-person cash is the exception and online banking the third case. The
 * method is descriptive — it changes no balance and no report total.
 *
 * Module scope matters: `SelectField` and `FilterSelect` memoise Base UI's
 * `items` label map off this array's identity, so it is computed once at import.
 */
export const HANDOVER_METHODS = ['KPAY', 'CASH', 'BANK_TRANSFER'] as const

export type HandoverMethod = (typeof HANDOVER_METHODS)[number]

/** Typed over the union, so forgetting a label is a compile error, not a blank cell. */
const LABELS: Record<HandoverMethod, string> = {
  KPAY: 'KPay',
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
}

export const HANDOVER_METHOD_OPTIONS = HANDOVER_METHODS.map((value) => ({
  value,
  label: LABELS[value],
}))

export function handoverMethodLabel(value: HandoverMethod): string {
  return LABELS[value]
}

/**
 * Narrows a value that arrived as a plain string — an audit row, a query param —
 * to the union. A `toHandoverMethod` that coerced instead would relabel anything
 * unrecognised as `KPAY`, which is a claim where a check is needed.
 */
export function isHandoverMethod(value: string): value is HandoverMethod {
  return (HANDOVER_METHODS as readonly string[]).includes(value)
}
