import { Badge } from '@/components/ui/badge'
import type { Order } from '@/features/orders/api'
import { calculateShopSettlement, type ShopSettlement, type ShopSettlementState } from '@/features/orders/money'
import { badgeClass, formatDecimalAmount, type BadgeTone } from '@/lib/utils'

interface ShopSettlementBadgeProps {
  order: Pick<Order, 'status' | 'packagePrice' | 'deliveryFee' | 'isPackagePaidToShop' | 'isFeePaidToShop' | 'shopAdvanceAmount'>
}

const SHOP_SETTLEMENT_LABELS: Record<ShopSettlementState, string> = {
  PAID: 'Paid',
  PARTLY_PAID: 'Partly paid',
  UNPAID: 'Unpaid',
  CUSTOMER_PAID: 'Customer paid',
  /** Never rendered: the component returns a plain dash for this state. */
  NOTHING_PAYABLE: '—',
  SHOP_OWES_COMPANY: 'Shop owes company',
}

/**
 * `null` keeps the quiet secondary badge. `UNPAID` and `CUSTOMER_PAID` are the
 * ordinary cases — no advance recorded yet, or nothing owed at all — so colour
 * there would make the normal row look like an alert; `PAID` and the two states
 * where money is outstanding or held get one.
 */
const SHOP_SETTLEMENT_TONES: Record<ShopSettlementState, BadgeTone | null> = {
  PAID: 'positive',
  PARTLY_PAID: 'warning',
  UNPAID: null,
  CUSTOMER_PAID: null,
  NOTHING_PAYABLE: null,
  SHOP_OWES_COMPANY: 'warning',
}

/**
 * The figure the badge replaced, kept as the reason on hover rather than lost
 * with the column. The state text carries the meaning, so the colour is never
 * the only signal.
 */
function describeSettlement(order: ShopSettlementBadgeProps['order'], settlement: ShopSettlement): string {
  const advanced = formatDecimalAmount(settlement.shopAdvanceAmount)
  const packageOwed = formatDecimalAmount(settlement.packageOwed)
  const netOwed = formatDecimalAmount(settlement.netOwedToShop)
  // Net owed is what the old amount column printed, and it already has the fee
  // the shop collected taken out of it — say so, or the arithmetic looks wrong.
  const deductedFeeNote = order.isFeePaidToShop
    ? ` That already deducts the ${formatDecimalAmount(order.deliveryFee)} delivery fee the shop collected.`
    : ''
  if (settlement.state === 'PAID') {
    return `The company advanced ${advanced}, covering the ${packageOwed} owed to the shop for this package.`
  }
  if (settlement.state === 'PARTLY_PAID') {
    return `The company advanced ${advanced}; net owed to the shop is ${netOwed}.${deductedFeeNote}`
  }
  if (settlement.state === 'UNPAID') {
    return `No advance is recorded, so the company owes the shop ${netOwed}.${deductedFeeNote}`
  }
  if (settlement.state === 'CUSTOMER_PAID') {
    return 'The customer already paid the shop for this package, so the company owes nothing for it.'
  }
  if (settlement.state === 'NOTHING_PAYABLE') {
    return order.status === 'CANCELLED'
      ? 'This order is cancelled, so nothing is payable to the shop.'
      : 'This order carries no package price, so there is nothing to pay the shop.'
  }
  // The only state left is SHOP_OWES_COMPANY.
  if (order.status === 'CANCELLED') {
    return `Cancelled after an advance of ${advanced} — the shop owes that money back.`
  }
  return `The shop holds company money: net owed to the shop is ${netOwed}.${deductedFeeNote}`
}

/**
 * The state alone does not say how much is outstanding, so the two states where
 * that number is the point of reading the cell print it beside the label. The
 * rest keep the label only — an inline amount costs no row height, where a
 * second line under every row would.
 */
function settlementAmount(settlement: ShopSettlement): string {
  if (settlement.state === 'PARTLY_PAID') return formatDecimalAmount(settlement.netOwedToShop)
  if (settlement.state === 'SHOP_OWES_COMPANY') return formatDecimalAmount(settlement.amountHeldByShop)
  return ''
}

export function ShopSettlementBadge({ order }: ShopSettlementBadgeProps) {
  const settlement = calculateShopSettlement(order)
  const description = describeSettlement(order, settlement)
  // A cancelled order has no settlement to report and the Status column already
  // says why, so it shows a quiet dash rather than a pill that says nothing.
  // The dash is not just decoration, so the reason is repeated for screen
  // readers — `title` alone is hover-only.
  if (settlement.state === 'NOTHING_PAYABLE') {
    return (
      <span className="text-muted-foreground" title={description}>
        —<span className="sr-only"> {description}</span>
      </span>
    )
  }
  const tone = SHOP_SETTLEMENT_TONES[settlement.state]
  const amount = settlementAmount(settlement)
  return (
    <Badge variant="secondary" className={tone ? badgeClass(tone) : undefined} title={description}>
      {SHOP_SETTLEMENT_LABELS[settlement.state]}
      {amount && <span className="font-mono font-normal"> · {amount}</span>}
      <span className="sr-only">. {description}</span>
    </Badge>
  )
}
