import type { Order } from '@/features/orders/api'

function toMinorUnits(value: string): bigint {
  const normalizedValue = value.trim()
  if (!/^\d{0,10}(\.\d{0,2})?$/.test(normalizedValue)) return 0n
  const [whole = '0', fractional = ''] = normalizedValue.split('.')
  const paddedFractional = fractional.padEnd(2, '0').slice(0, 2)
  return BigInt(whole) * 100n + BigInt(paddedFractional || '0')
}

function fromMinorUnits(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absoluteValue = value < 0n ? -value : value
  const whole = (absoluteValue / 100n).toString()
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fractional = (absoluteValue % 100n).toString().padStart(2, '0')
  return `${sign}${groupedWhole}.${fractional}`
}

export function calculateCodToCollect(order: Pick<Order, 'packagePrice' | 'deliveryFee' | 'isPackagePaidToShop' | 'isFeePaidToShop'>): string {
  const packageAmount = order.isPackagePaidToShop ? 0n : toMinorUnits(order.packagePrice)
  const deliveryAmount = order.isFeePaidToShop ? 0n : toMinorUnits(order.deliveryFee)
  return fromMinorUnits(packageAmount + deliveryAmount)
}

type NetOwedToShopOrder = Pick<
  Order,
  'packagePrice' | 'deliveryFee' | 'isPackagePaidToShop' | 'isFeePaidToShop' | 'shopAdvanceAmount'
>

/**
 * The net-owed formula lives here once, in minor units, because
 * `fromMinorUnits` groups thousands and `toMinorUnits` rejects the comma —
 * so parsing a formatted amount back in silently yields zero.
 */
function netOwedToShopMinorUnits(order: NetOwedToShopOrder): bigint {
  const packageAmount = order.isPackagePaidToShop ? 0n : toMinorUnits(order.packagePrice)
  const deliveryAmount = order.isFeePaidToShop ? toMinorUnits(order.deliveryFee) : 0n
  return packageAmount - deliveryAmount - toMinorUnits(order.shopAdvanceAmount)
}

export function calculateNetOwedToShop(order: NetOwedToShopOrder): string {
  return fromMinorUnits(netOwedToShopMinorUnits(order))
}

/**
 * `calculateNetOwedToShop` returns a negative number whenever the shop holds
 * company money — it collected the delivery fee, or the order was advanced and
 * then cancelled. Shown wherever the figure is printed bare, so a minus sign is
 * never read as a data error.
 */
export const NET_OWED_SIGN_NOTE =
  'Net owed to shop can be negative: positive means the company owes the shop; negative means the shop owes the company.'

/**
 * Whether the company has paid the shop for this order's package, as a state an
 * operator can act on rather than a number they have to read a sign on.
 *
 * The two payment flags are **customer-side only** — `isPackagePaidToShop` means
 * the customer already paid the shop, so the company never owed the package
 * price; the company's own payment is the recorded advance. `CANCELLED` is
 * handled first because the reports count it as `0` against every payable
 * figure, so a cancelled order is never "not paid" here either — only an advance
 * already paid against it is still outstanding, and that is money owed back.
 */
export const SHOP_SETTLEMENT_STATES = [
  'PAID',
  'PARTLY_PAID',
  'UNPAID',
  'CUSTOMER_PAID',
  'NOTHING_PAYABLE',
  'SHOP_OWES_COMPANY',
] as const

export type ShopSettlementState = (typeof SHOP_SETTLEMENT_STATES)[number]

export interface ShopSettlement {
  state: ShopSettlementState
  /** What the company owes the shop for the package, before the advance. */
  packageOwed: string
  /** Signed net owed to shop, identical to `calculateNetOwedToShop`. */
  netOwedToShop: string
  /** The snapshotted amount the shop was advanced; `'0.00'` when none. */
  shopAdvanceAmount: string
}

type ShopSettlementOrder = Pick<
  Order,
  'status' | 'packagePrice' | 'deliveryFee' | 'isPackagePaidToShop' | 'isFeePaidToShop' | 'shopAdvanceAmount'
>

export function calculateShopSettlement(order: ShopSettlementOrder): ShopSettlement {
  const packageOwedMinorUnits = order.isPackagePaidToShop ? 0n : toMinorUnits(order.packagePrice)
  const advanceMinorUnits = toMinorUnits(order.shopAdvanceAmount)
  const netOwedMinorUnits = netOwedToShopMinorUnits(order)
  const amounts = {
    packageOwed: fromMinorUnits(packageOwedMinorUnits),
    netOwedToShop: fromMinorUnits(netOwedMinorUnits),
    shopAdvanceAmount: fromMinorUnits(advanceMinorUnits),
  }
  if (order.status === 'CANCELLED') {
    return { state: advanceMinorUnits > 0n ? 'SHOP_OWES_COMPANY' : 'NOTHING_PAYABLE', ...amounts }
  }
  // A negative net means the shop holds company money — the fee it collected, or
  // an advance beyond what was owed — and no payable state outranks that.
  if (netOwedMinorUnits < 0n) return { state: 'SHOP_OWES_COMPANY', ...amounts }
  // Nothing for the company to pay, for one of two reasons: the customer already
  // settled the shop, or the package carries no price. Only the first is worth
  // naming in the column; neither is a payment the company made or owes.
  if (order.isPackagePaidToShop) return { state: 'CUSTOMER_PAID', ...amounts }
  if (packageOwedMinorUnits === 0n) return { state: 'NOTHING_PAYABLE', ...amounts }
  if (advanceMinorUnits === 0n) return { state: 'UNPAID', ...amounts }
  if (advanceMinorUnits < packageOwedMinorUnits) return { state: 'PARTLY_PAID', ...amounts }
  return { state: 'PAID', ...amounts }
}

export function calculateEstimatedDate(leadTimeDays: number, startingDate = new Date()): string {
  const estimatedDate = new Date(startingDate)
  estimatedDate.setDate(estimatedDate.getDate() + leadTimeDays)
  const year = estimatedDate.getFullYear()
  const month = `${estimatedDate.getMonth() + 1}`.padStart(2, '0')
  const day = `${estimatedDate.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
