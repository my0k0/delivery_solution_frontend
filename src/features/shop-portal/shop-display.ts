import type { ShopDisplayStatus, ShopOrderStatus } from '@/features/shop-portal/api'

export const SHOP_STATUS_OPTIONS: ReadonlyArray<{ value: ShopOrderStatus; label: string }> = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function getShopStatusLabel(status: ShopDisplayStatus): string {
  return SHOP_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

export function formatShopDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatShopDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
