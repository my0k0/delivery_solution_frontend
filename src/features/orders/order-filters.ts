import type { UrlFilterSchema } from '@/lib/url/useUrlFilters'
import { getTodayDate, isIsoCalendarDate } from '@/features/reports/date-range'
import {
  ORDER_STATUSES,
  type OrderDateBasis,
  type OrderStatus,
  type ShopAdvanceFilter,
} from './api'

/**
 * The Orders list as it appears in the URL.
 *
 * The URL is the source of truth, so every value here round-trips through
 * `parseOrderFilters` / `serializeOrderFilters`. Two rules keep that honest:
 *
 * - **Defaults are omitted.** `/orders` means "today, entry date basis, page 1".
 *   Storing "today" would be a lie tomorrow; omitting it means the same link
 *   resolves to the same *intent* on any day.
 * - **An explicitly cleared date is a sentinel.** A missing `dateFrom` means the
 *   default (today), so "no lower bound" is written as `dateFrom=` with an empty
 *   value and told apart with `URLSearchParams.has`. Without that, clearing the
 *   field would silently snap back to today and hide older orders.
 */

export const SHOP_ADVANCE_FILTERS = [
  'NOT_ADVANCED',
  'ADVANCED',
] as const satisfies readonly ShopAdvanceFilter[]

export const ORDER_DATE_BASES = ['ENTRY', 'DELIVERED'] as const satisfies readonly OrderDateBasis[]

/** The two values `isPackagePaidToShop` accepts in the URL, in display order. */
export const PACKAGE_PAYMENT_FILTERS = ['false', 'true'] as const

export type PackagePaymentFilter = (typeof PACKAGE_PAYMENT_FILTERS)[number]

export interface OrderFilterValues {
  page: number
  /** Raw as typed — trimming happens when the request is built, never while typing. */
  search: string
  status: OrderStatus | ''
  shopId: string
  townshipId: string
  assigneeId: string
  shopAdvance: ShopAdvanceFilter | ''
  /** `''` = any, otherwise the literal the API expects. */
  isPackagePaidToShop: '' | 'true' | 'false'
  /** `YYYY-MM-DD`; `''` = unbounded. */
  dateFrom: string
  dateTo: string
  dateBasis: OrderDateBasis
}

/** A function, not a constant: "today" moves. */
export function defaultOrderFilters(): OrderFilterValues {
  const today = getTodayDate()
  return {
    page: 1,
    search: '',
    status: '',
    shopId: '',
    townshipId: '',
    assigneeId: '',
    shopAdvance: '',
    isPackagePaidToShop: '',
    dateFrom: today,
    dateTo: today,
    dateBasis: 'ENTRY',
  }
}

/**
 * Narrows a raw string to the union, or `''` for "all".
 *
 * `find` rather than `includes`: a `readonly OrderStatus[]` cannot be asked
 * whether it contains an arbitrary `string` without a cast, and `''` has to mean
 * "no filter" rather than being coerced to some status.
 */
export function toOrderStatus(value: string): OrderStatus | '' {
  return ORDER_STATUSES.find((status) => status === value) ?? ''
}

export function toShopAdvance(value: string): ShopAdvanceFilter | '' {
  return SHOP_ADVANCE_FILTERS.find((advance) => advance === value) ?? ''
}

export function toOrderDateBasis(value: string): OrderDateBasis {
  return ORDER_DATE_BASES.find((basis) => basis === value) ?? 'ENTRY'
}

/** Narrows a raw string to the package-payment literals, or `''` for "any". */
export function toPackagePayment(value: string): PackagePaymentFilter | '' {
  return PACKAGE_PAYMENT_FILTERS.find((payment) => payment === value) ?? ''
}

function readPage(params: URLSearchParams): number {
  const raw = params.get('page')
  if (raw === null) return 1
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

export function parseOrderFilters(params: URLSearchParams): OrderFilterValues {
  const defaults = defaultOrderFilters()

  const readDate = (name: 'dateFrom' | 'dateTo'): string => {
    if (!params.has(name)) return defaults[name]
    const raw = params.get(name) ?? ''
    if (raw === '') return ''
    return isIsoCalendarDate(raw) ? raw : defaults[name]
  }

  return {
    page: readPage(params),
    search: params.get('search') ?? '',
    status: toOrderStatus(params.get('status') ?? ''),
    shopId: params.get('shopId') ?? '',
    townshipId: params.get('townshipId') ?? '',
    assigneeId: params.get('assigneeId') ?? '',
    shopAdvance: toShopAdvance(params.get('shopAdvance') ?? ''),
    isPackagePaidToShop: toPackagePayment(params.get('isPackagePaidToShop') ?? ''),
    dateFrom: readDate('dateFrom'),
    dateTo: readDate('dateTo'),
    dateBasis: toOrderDateBasis(params.get('dateBasis') ?? ''),
  }
}

export function serializeOrderFilters(values: OrderFilterValues): URLSearchParams {
  const defaults = defaultOrderFilters()
  const params = new URLSearchParams()

  if (values.page !== defaults.page) params.set('page', String(values.page))
  if (values.search !== '') params.set('search', values.search)
  if (values.status !== '') params.set('status', values.status)
  if (values.shopId !== '') params.set('shopId', values.shopId)
  if (values.townshipId !== '') params.set('townshipId', values.townshipId)
  if (values.assigneeId !== '') params.set('assigneeId', values.assigneeId)
  if (values.shopAdvance !== '') params.set('shopAdvance', values.shopAdvance)
  if (values.isPackagePaidToShop !== '') {
    params.set('isPackagePaidToShop', values.isPackagePaidToShop)
  }
  // An empty value is the sentinel for "explicitly cleared", so these are
  // compared rather than tested for truthiness.
  if (values.dateFrom !== defaults.dateFrom) params.set('dateFrom', values.dateFrom)
  if (values.dateTo !== defaults.dateTo) params.set('dateTo', values.dateTo)
  if (values.dateBasis !== defaults.dateBasis) params.set('dateBasis', values.dateBasis)

  return params
}

export const ORDERS_FILTER_SCHEMA: UrlFilterSchema<OrderFilterValues> = {
  defaults: defaultOrderFilters,
  parse: parseOrderFilters,
  serialize: serializeOrderFilters,
}
