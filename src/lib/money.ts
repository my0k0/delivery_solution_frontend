function toMinorUnits(value: string): bigint {
  const normalizedValue = value.trim()
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalizedValue)
  if (!match) return 0n
  const sign = match[1] === '-' ? -1n : 1n
  const whole = BigInt(match[2] ?? '0')
  const fractional = BigInt((match[3] ?? '').padEnd(2, '0') || '0')
  return sign * (whole * 100n + fractional)
}

function fromMinorUnits(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absoluteValue = value < 0n ? -value : value
  const whole = (absoluteValue / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fractional = (absoluteValue % 100n).toString().padStart(2, '0')
  return `${sign}${whole}.${fractional}`
}

export function sumMoney(values: readonly string[]): string {
  return fromMinorUnits(values.reduce((total, value) => total + toMinorUnits(value), 0n))
}

export function maximumMoney(values: readonly string[]): string {
  return fromMinorUnits(values.reduce((maximum, value) => {
    const minorUnits = toMinorUnits(value)
    return minorUnits > maximum ? minorUnits : maximum
  }, 0n))
}

/**
 * `left − right`, exactly, on the same bigint minor units as the other helpers.
 * The handover dialog uses it to show the balance an entry would leave behind, so
 * an over-recording is visible before it is saved rather than only after. Not for
 * stored figures: the API's balances come from Postgres `numeric` and are never
 * re-added in JS.
 */
export function subtractMoney(left: string, right: string): string {
  return fromMinorUnits(toMinorUnits(left) - toMinorUnits(right))
}

/**
 * Whether `amount` is strictly more than `ceiling`, compared on the same bigint
 * minor units as the other helpers so `16500` and `16500.00` agree.
 *
 * The handover dialog uses it to decide whether recording an amount needs a
 * confirmation, because that decision must match the arithmetic the balance is
 * displayed with. A value that is not an amount at all reads as zero here, so a
 * caller compares only input it has already validated.
 */
export function isMoreMoneyThan(amount: string, ceiling: string): boolean {
  return toMinorUnits(amount) > toMinorUnits(ceiling)
}

/** A decimal amount: an optional sign, digits, and at most two decimals. */
const DECIMAL_MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/

/**
 * Whether a string is a decimal amount at all — the gate for every reader here.
 * `toMinorUnits` reads unparseable input as zero, so a caller that formats must
 * ask first; otherwise `'abc'` renders as `0.00` and reads as a real figure.
 */
export function isMoneyString(value: string): boolean {
  return DECIMAL_MONEY_PATTERN.test(value.trim())
}

/**
 * Whether an amount is exactly zero, whatever spelling it arrives in (`'0.00'`,
 * `'0'`, `'-0.00'`). A value that is not an amount at all is never settled.
 */
export function isZeroMoney(value: string): boolean {
  return isMoneyString(value) && toMinorUnits(value) === 0n
}

export function formatMmk(value: string): string {
  return `${fromMinorUnits(toMinorUnits(value))} MMK`
}

export function moneyRatioPercent(value: string, maximum: string): number {
  const maximumMinorUnits = toMinorUnits(maximum)
  if (maximumMinorUnits <= 0n) return 0
  const valueMinorUnits = toMinorUnits(value)
  if (valueMinorUnits <= 0n) return 0
  return Number((valueMinorUnits * 100n) / maximumMinorUnits)
}
