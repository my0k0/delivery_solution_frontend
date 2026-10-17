import { http } from '@/lib/api/client'
import type { components, operations } from '@/types/api'

export type OrderStatus = components['schemas']['OrderStatus']
export type AssigneeType = Exclude<components['schemas']['OrderResponseDto']['assigneeType'], null | undefined>
export type OrderDateBasis = NonNullable<NonNullable<operations['OrdersController_list_v1']['parameters']['query']>['dateBasis']>

export const ORDER_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'AWAITING_APPROVAL',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
] as const satisfies readonly OrderStatus[]

export type OrderFilters = NonNullable<operations['OrdersController_list_v1']['parameters']['query']> & {
  page: number
  perPage: number
}

type GeneratedOrderResponse = components['schemas']['OrderResponseDto']
type OrderNullableFields =
  | 'townshipId'
  | 'riderId'
  | 'wayId'
  | 'partnerId'
  | 'partnerTrackingNo'
  | 'packageInfo'
  | 'estimatedDeliveryDate'
  | 'deliveredAt'
  | 'deliveryAddress'
  | 'cancelReason'
  | 'notes'

export type Order = Omit<GeneratedOrderResponse, OrderNullableFields> & {
  townshipId: string | null
  riderId: string | null
  wayId: string | null
  partnerId: string | null
  partnerTrackingNo: string | null
  packageInfo: Record<string, unknown> | null
  estimatedDeliveryDate: string | null
  deliveredAt: string | null
  deliveryAddress: string | null
  cancelReason: string | null
  notes: string | null
}

type GeneratedOrderHistory = components['schemas']['OrderHistoryResponseDto']
type AssigneeSnapshot = { type: AssigneeType; riderId: string | null; partnerId: string | null }
export type OrderHistory = Omit<GeneratedOrderHistory, 'changedBy' | 'note' | 'reason' | 'internalNote' | 'previousAssignee' | 'newAssignee'> & {
  changedBy: string | null
  note: string | null
  reason: string | null
  internalNote: string | null
  previousAssignee: AssigneeSnapshot | null
  newAssignee: AssigneeSnapshot | null
}

export type OrderDetail = Order & { history: OrderHistory[] }

type GeneratedAuditEntry = components['schemas']['OrderFieldAuditResponseDto']
export type OrderAuditEntry = Omit<GeneratedAuditEntry, 'oldValue' | 'newValue' | 'actorId' | 'reason'> & {
  oldValue: unknown
  newValue: unknown
  actorId: string | null
  reason: string | null
}

type GeneratedOrderList = components['schemas']['OrderListResponseDto']
export type Page<T> = Omit<GeneratedOrderList, 'data'> & { data: T[] }

type GeneratedCreateOrder = components['schemas']['CreateOrderDto']
export type OrderBody = Omit<GeneratedCreateOrder, 'townshipId' | 'riderId' | 'partnerId' | 'packageInfo' | 'estimatedDeliveryDate' | 'deliveryAddress' | 'partnerTrackingNo' | 'notes'> & {
  townshipId: string | null
  riderId?: string | null
  partnerId?: string | null
  packageInfo?: Record<string, unknown> | null
  estimatedDeliveryDate: string | null
  deliveryAddress: string | null
  partnerTrackingNo: string | null
  notes: string | null
}

type GeneratedUpdateOrder = components['schemas']['UpdateOrderDto']
export type UpdateOrderBody = Omit<GeneratedUpdateOrder, 'townshipId' | 'riderId' | 'partnerId' | 'partnerTrackingNo' | 'packageInfo' | 'estimatedDeliveryDate' | 'deliveryAddress' | 'notes' | 'reason'> & {
  townshipId?: string | null
  riderId?: string | null
  partnerId?: string | null
  partnerTrackingNo?: string | null
  packageInfo?: Record<string, unknown> | null
  estimatedDeliveryDate?: string | null
  deliveryAddress?: string | null
  notes?: string | null
  reason?: string | null
}

export type Township = Omit<components['schemas']['TownshipResponseDto'], 'defaultAssigneeType' | 'defaultRiderId' | 'defaultPartnerId'> & {
  defaultAssigneeType: AssigneeType | null
  defaultRiderId: string | null
  defaultPartnerId: string | null
}

export type DeliveryPartner = Omit<components['schemas']['DeliveryPartnerResponseDto'], 'phone' | 'note'> & {
  phone: string | null
  note: string | null
}

export type DeliveryPartnerBody = Pick<components['schemas']['CreateDeliveryPartnerDto'], 'name' | 'isActive'> & {
  phone: string | null
  note: string | null
}

export type OrderReason = components['schemas']['OrderReasonDto']
export type SendBackBody = components['schemas']['SendBackOrderDto']
export type AssignBody = Omit<components['schemas']['AssignOrderDto'], 'riderId' | 'partnerId'> & {
  riderId?: string | null
  partnerId?: string | null
}

type GeneratedRiderBoardOrder = components['schemas']['RiderOrderResponseDto']
export type RiderBoardOrder = Omit<GeneratedRiderBoardOrder, 'customerPhone' | 'customerAddress' | 'townshipName' | 'notes' | 'wayId' | 'wayLabel'> & {
  customerPhone: string | null
  customerAddress: string | null
  townshipName: string | null
  notes: string | null
  wayId: string | null
  wayLabel: string | null
}

export type RiderBoardResponse = RiderBoardOrder[]

export const orderKeys = {
  all: ['workflow-orders'] as const,
  list: (filters: OrderFilters) => ['workflow-orders', 'list', filters] as const,
  detail: (orderId: string) => ['workflow-orders', 'detail', orderId] as const,
  audit: (orderId: string) => ['workflow-orders', 'audit', orderId] as const,
  townships: ['workflow-townships'] as const,
  partners: ['workflow-partners'] as const,
  riderBoard: ['workflow-rider-board'] as const,
}

export async function fetchOrders(filters: OrderFilters): Promise<Page<Order>> {
  return (await http.get<Page<Order>>('/orders', { params: filters })).data
}

export async function fetchOrder(orderId: string): Promise<OrderDetail> {
  return (await http.get<OrderDetail>(`/orders/${orderId}`)).data
}

export async function fetchOrderAudit(orderId: string): Promise<OrderAuditEntry[]> {
  return (await http.get<OrderAuditEntry[]>(`/orders/${orderId}/audit`)).data
}

export async function createOrder(body: OrderBody): Promise<Order> {
  return (await http.post<Order>('/orders', body)).data
}

export async function updateOrder(orderId: string, body: UpdateOrderBody): Promise<Order> {
  return (await http.patch<Order>(`/orders/${orderId}`, body)).data
}

export async function assignOrder(orderId: string, body: AssignBody): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/assign`, body)).data
}

export async function postponeOrder(orderId: string, body: OrderReason): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/postpone`, body)).data
}

export async function cancelOrder(orderId: string, body: OrderReason): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/cancel`, body)).data
}

export async function returnOrder(orderId: string, body: OrderReason): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/return`, body)).data
}

export async function approveOrder(orderId: string): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/approve`)).data
}

export async function sendBackOrder(orderId: string, body: SendBackBody): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/send-back`, body)).data
}

export async function markPartnerDelivered(orderId: string): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/mark-delivered`)).data
}

export async function fetchTownships(): Promise<Township[]> {
  return (await http.get<Township[]>('/townships')).data
}

export async function fetchDeliveryPartners(): Promise<DeliveryPartner[]> {
  return (await http.get<DeliveryPartner[]>('/delivery-partners')).data
}

export async function createDeliveryPartner(body: DeliveryPartnerBody): Promise<DeliveryPartner> {
  return (await http.post<DeliveryPartner>('/delivery-partners', body)).data
}

export async function updateDeliveryPartner(partnerId: string, body: Partial<DeliveryPartnerBody>): Promise<DeliveryPartner> {
  return (await http.patch<DeliveryPartner>(`/delivery-partners/${partnerId}`, body)).data
}

export async function deleteDeliveryPartner(partnerId: string): Promise<void> {
  await http.delete(`/delivery-partners/${partnerId}`)
}

export async function fetchRiderBoard(): Promise<RiderBoardResponse> {
  return (await http.get<RiderBoardResponse>('/riders/me/orders')).data
}

export async function submitRiderDelivered(orderId: string): Promise<{ id: string; status: OrderStatus; deliveredAt: string }> {
  return (await http.post<{ id: string; status: OrderStatus; deliveredAt: string }>(`/riders/me/orders/${orderId}/delivered`)).data
}
