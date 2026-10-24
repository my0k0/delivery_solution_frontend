import type { UrlFilterSchema } from '@/lib/url/useUrlFilters'
import { isIsoCalendarDate } from '@/features/reports/date-range'
import { isHandoverMethod, type HandoverMethod } from './handover-methods'

/**
 * The Rider handovers page in the URL.
 *
 * One schema for the whole page, not one per section: both sections write the
 * same query string, and two schemas would each rewrite it from their own
 * values, deleting the other's filters.
 *
 * There are no date defaults here — the history starts unfiltered — so a
 * missing `dateFrom` already means "no lower bound" and no sentinel is needed
 * (unlike the Orders list, whose bounds default to today).
 */

export interface HandoverPageFilterValues {
  /** History table. */
  page: number
  riderId: string
  method: HandoverMethod | ''
  dateFrom: string
  dateTo: string
  /** Outstanding-balances table — its own page, so one section paging cannot
   * move the other. */
  balancePage: number
  balanceSearch: string
  outstandingOnly: boolean
}

export function defaultHandoverFilters(): HandoverPageFilterValues {
  return {
    page: 1,
    riderId: '',
    method: '',
    dateFrom: '',
    dateTo: '',
    balancePage: 1,
    balanceSearch: '',
    outstandingOnly: false,
  }
}

function readPage(params: URLSearchParams, name: string): number {
  const raw = params.get(name)
  if (raw === null) return 1
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

function readDate(params: URLSearchParams, name: 'dateFrom' | 'dateTo'): string {
  const raw = params.get(name) ?? ''
  return isIsoCalendarDate(raw) ? raw : ''
}

export function parseHandoverFilters(params: URLSearchParams): HandoverPageFilterValues {
  const method = params.get('method') ?? ''
  return {
    page: readPage(params, 'page'),
    riderId: params.get('riderId') ?? '',
    method: isHandoverMethod(method) ? method : '',
    dateFrom: readDate(params, 'dateFrom'),
    dateTo: readDate(params, 'dateTo'),
    balancePage: readPage(params, 'balancePage'),
    balanceSearch: params.get('balanceSearch') ?? '',
    outstandingOnly: params.get('outstandingOnly') === 'true',
  }
}

export function serializeHandoverFilters(values: HandoverPageFilterValues): URLSearchParams {
  const params = new URLSearchParams()
  if (values.page !== 1) params.set('page', String(values.page))
  if (values.riderId !== '') params.set('riderId', values.riderId)
  if (values.method !== '') params.set('method', values.method)
  if (values.dateFrom !== '') params.set('dateFrom', values.dateFrom)
  if (values.dateTo !== '') params.set('dateTo', values.dateTo)
  if (values.balancePage !== 1) params.set('balancePage', String(values.balancePage))
  if (values.balanceSearch !== '') params.set('balanceSearch', values.balanceSearch)
  if (values.outstandingOnly) params.set('outstandingOnly', 'true')
  return params
}

export const HANDOVER_FILTER_SCHEMA: UrlFilterSchema<HandoverPageFilterValues> = {
  defaults: defaultHandoverFilters,
  parse: parseHandoverFilters,
  serialize: serializeHandoverFilters,
}
