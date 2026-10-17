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

export function calculateNetOwedToShop(order: Pick<Order, 'packagePrice' | 'deliveryFee' | 'isPackagePaidToShop' | 'isFeePaidToShop'>): string {
  const packageAmount = order.isPackagePaidToShop ? 0n : toMinorUnits(order.packagePrice)
  const deliveryAmount = order.isFeePaidToShop ? toMinorUnits(order.deliveryFee) : 0n
  return fromMinorUnits(packageAmount - deliveryAmount)
}

export function calculateEstimatedDate(leadTimeDays: number, startingDate = new Date()): string {
  const estimatedDate = new Date(startingDate)
  estimatedDate.setDate(estimatedDate.getDate() + leadTimeDays)
  const year = estimatedDate.getFullYear()
  const month = `${estimatedDate.getMonth() + 1}`.padStart(2, '0')
  const day = `${estimatedDate.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
