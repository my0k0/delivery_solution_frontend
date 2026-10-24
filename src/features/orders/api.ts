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
  | 'shopAdvancedAt'

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
  /** Codegen emits a `Record<string, never>` stub for this nullable date; type it properly. */
  shopAdvancedAt: string | null
}

type GeneratedOrderHistory = components['schemas']['OrderHistoryResponseDto']
type AssigneeSnapshot = { type: AssigneeType; riderId: string | null; partnerId: string | null }
export type OrderHistory = Omit<GeneratedOrderHistory, 'changedBy' | 'changedByName' | 'note' | 'reason' | 'internalNote' | 'previousAssignee' | 'newAssignee'> & {
  changedBy: string | null
  changedByName: string | null
  note: string | null
  reason: string | null
  internalNote: string | null
  previousAssignee: AssigneeSnapshot | null
  newAssignee: AssigneeSnapshot | null
}

/**
 * `GET /orders/:id` resolves the referenced names, so an office reader who holds
 * `orders.read` without `shops.read` / `customers.read` / `riders.read` still
 * sees names rather than ids. The list endpoint carries ids only.
 */
export type OrderDetail = Order & {
  shopName: string | null
  customerName: string | null
  townshipName: string | null
  assigneeName: string | null
  history: OrderHistory[]
}

type GeneratedAuditEntry = components['schemas']['OrderFieldAuditResponseDto']
export type OrderAuditEntry = Omit<GeneratedAuditEntry, 'oldValue' | 'newValue' | 'actorId' | 'reason'> & {
  oldValue: unknown
  newValue: unknown
  actorId: string | null
  reason: string | null
}

/**
 * A photo captured with a delivery.
 *
 * `approvedAt` is what separates evidence from a capture that was rejected: a
 * sent-back submission keeps its row but never gets stamped, so a screen must
 * key "this proves the delivery" off `approvedAt`, never off list position.
 */
type GeneratedDeliveryProof = components['schemas']['DeliveryProofResponseDto']
export type DeliveryProof = Omit<GeneratedDeliveryProof, 'approvedAt' | 'approvedByName'> & {
  /** Codegen emits `Record<string, never>` stubs for these nullable fields; type them properly. */
  approvedAt: string | null
  approvedByName: string | null
}

/** What the rider's submit returns — the transition, not the proof. */
export type RiderDelivered = components['schemas']['RiderDeliveredResponseDto']

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

export type Township = components['schemas']['TownshipResponseDto']

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
export type ShopAdvanceBody = components['schemas']['ShopAdvanceDto']
export type ShopAdvanceFilter = NonNullable<
  NonNullable<operations['OrdersController_list_v1']['parameters']['query']>['shopAdvance']
>
export type AssignBody = Omit<components['schemas']['AssignOrderDto'], 'riderId' | 'partnerId'> & {
  riderId?: string | null
  partnerId?: string | null
}

type GeneratedRiderBoardOrder = components['schemas']['RiderOrderResponseDto']
export type RiderBoardOrder = Omit<GeneratedRiderBoardOrder, 'customerPhone' | 'customerAddress' | 'townshipName' | 'notes'> & {
  customerPhone: string | null
  customerAddress: string | null
  townshipName: string | null
  notes: string | null
}

export type RiderBoardResponse = RiderBoardOrder[]

export const orderKeys = {
  all: ['workflow-orders'] as const,
  list: (filters: OrderFilters) => ['workflow-orders', 'list', filters] as const,
  detail: (orderId: string) => ['workflow-orders', 'detail', orderId] as const,
  audit: (orderId: string) => ['workflow-orders', 'audit', orderId] as const,
  proofs: (orderId: string) => ['workflow-orders', 'proofs', orderId] as const,
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

/**
 * Every capture recorded for this order, newest first, each with a signed URL
 * that expires five minutes after it was minted — so this is refetched rather
 * than cached and reused.
 */
export async function fetchDeliveryProofs(orderId: string): Promise<DeliveryProof[]> {
  return (await http.get<DeliveryProof[]>(`/orders/${orderId}/delivery-proofs`)).data
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

export async function approveOrder(orderId: string): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/approve`)).data
}

export async function sendBackOrder(orderId: string, body: SendBackBody): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/send-back`, body)).data
}

export async function markPartnerDelivered(orderId: string): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/mark-delivered`)).data
}

/** The amount is never sent: the API snapshots the order's package price. */
export async function recordShopAdvance(orderId: string, body: ShopAdvanceBody): Promise<Order> {
  return (await http.post<Order>(`/orders/${orderId}/shop-advance`, body)).data
}

export async function clearShopAdvance(orderId: string, body: ShopAdvanceBody): Promise<Order> {
  return (await http.delete<Order>(`/orders/${orderId}/shop-advance`, { data: body })).data
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

export async function submitRiderDelivered(orderId: string, photo: File): Promise<RiderDelivered> {
  const body = new FormData()
  body.append('photo', photo)
  // No Content-Type here: axios sets `multipart/form-data` and adds the boundary itself.
  return (await http.post<RiderDelivered>(`/riders/me/orders/${orderId}/delivered`, body)).data
}
