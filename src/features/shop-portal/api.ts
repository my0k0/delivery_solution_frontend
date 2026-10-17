import { useQuery } from '@tanstack/react-query'
import { http } from '@/lib/api/client'
import type { components } from '@/types/api'

export type ShopOrderStatus = components['schemas']['ShopOrderListItemDto']['displayStatus']
export type ShopDisplayStatus = components['schemas']['ShopOrderHistoryEventDto']['displayStatus']
export type ShopDashboard = components['schemas']['ShopDashboardResponseDto']
export type ShopStatement = components['schemas']['ShopStatementResponseDto']

type GeneratedShopOrder = components['schemas']['ShopOrderListItemDto']
type GeneratedShopOrderDetail = components['schemas']['ShopOrderDetailResponseDto']

export type ShopOrder = Omit<GeneratedShopOrder, 'customerPhone' | 'deliveryAddress' | 'townshipName' | 'deliveredAt'> & {
  customerPhone?: string | null
  deliveryAddress?: string | null
  townshipName?: string | null
  deliveredAt?: string | null
}

export type ShopOrderDetail = Omit<GeneratedShopOrderDetail, 'customerPhone' | 'deliveryAddress' | 'townshipName' | 'deliveredAt' | 'history'> & {
  customerPhone?: string | null
  deliveryAddress?: string | null
  townshipName?: string | null
  deliveredAt?: string | null
  history: Array<Omit<components['schemas']['ShopOrderHistoryEventDto'], 'reason'> & { reason?: string | null }>
}

export interface ShopOrdersQuery {
  dateFrom: string
  dateTo: string
  dateBasis: 'ENTRY' | 'DELIVERED'
  timeFrom?: string
  timeTo?: string
  displayStatus?: ShopOrderStatus
  needsAttention?: boolean
  search?: string
  page: number
  perPage: number
}

export interface ShopDateQuery {
  dateFrom: string
  dateTo: string
  dateBasis: 'ENTRY' | 'DELIVERED'
}

export type ShopOrdersResponse = Omit<components['schemas']['ShopOrderListResponseDto'], 'data'> & { data: ShopOrder[] }

export const shopPortalKeys = {
  all: ['shop-portal'] as const,
  orders: (query: ShopOrdersQuery) => ['shop-portal', 'orders', query] as const,
  order: (orderId: string) => ['shop-portal', 'order', orderId] as const,
  dashboard: (query: ShopDateQuery) => ['shop-portal', 'dashboard', query] as const,
  statement: (query: ShopDateQuery) => ['shop-portal', 'statement', query] as const,
}

export async function fetchShopOrders(query: ShopOrdersQuery): Promise<ShopOrdersResponse> {
  return (await http.get<ShopOrdersResponse>('/shop/orders', { params: query })).data
}

export async function fetchShopOrder(orderId: string): Promise<ShopOrderDetail> {
  return (await http.get<ShopOrderDetail>(`/shop/orders/${orderId}`)).data
}

export async function fetchShopDashboard(query: ShopDateQuery): Promise<ShopDashboard> {
  return (await http.get<ShopDashboard>('/shop/dashboard', { params: query })).data
}

export async function fetchShopStatement(query: ShopDateQuery): Promise<ShopStatement> {
  return (await http.get<ShopStatement>('/shop/statement', { params: query })).data
}

export async function downloadShopFile(
  endpoint: '/shop/orders/export' | '/shop/statement/export',
  query: ShopDateQuery & { format: 'csv' | 'xlsx' } & Partial<Pick<ShopOrdersQuery, 'timeFrom' | 'timeTo' | 'displayStatus' | 'needsAttention' | 'search'>>,
): Promise<void> {
  const response = await http.get<Blob>(endpoint, { params: query, responseType: 'blob' })
  const fileType = query.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const file = new Blob([response.data], { type: fileType })
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `shop-${endpoint.includes('orders') ? 'orders' : 'statement'}.${query.format}`
  link.click()
  URL.revokeObjectURL(objectUrl)
}

export function useShopOrders(query: ShopOrdersQuery) {
  return useQuery({ queryKey: shopPortalKeys.orders(query), queryFn: () => fetchShopOrders(query) })
}

export function useShopOrder(orderId: string) {
  return useQuery({ queryKey: shopPortalKeys.order(orderId), queryFn: () => fetchShopOrder(orderId), enabled: Boolean(orderId) })
}

export function useShopDashboard(query: ShopDateQuery) {
  return useQuery({ queryKey: shopPortalKeys.dashboard(query), queryFn: () => fetchShopDashboard(query) })
}

export function useShopStatement(query: ShopDateQuery) {
  return useQuery({ queryKey: shopPortalKeys.statement(query), queryFn: () => fetchShopStatement(query) })
}
