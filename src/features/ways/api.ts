import { http } from '@/lib/api/client'
import type { components, operations } from '@/types/api'

export type WayState = components['schemas']['WayResponseDto']['state']

type GeneratedWay = components['schemas']['WayResponseDto']
type GeneratedWayDetail = components['schemas']['WayDetailResponseDto']
type GeneratedWayOrder = components['schemas']['WayOrderResponseDto']

export type Way = Omit<GeneratedWay, 'payAnywayReason' | 'payAnywayBy' | 'payAnywayAt'> & {
  payAnywayReason: string | null
  payAnywayBy: string | null
  payAnywayAt: string | null
}

export type WayOrder = Omit<GeneratedWayOrder, 'wayId' | 'riderId' | 'partnerId' | 'deliveredAt'> & {
  wayId: string | null
  riderId: string | null
  partnerId: string | null
  deliveredAt: string | null
}

export type WayDetail = Omit<GeneratedWayDetail, 'payAnywayReason' | 'payAnywayBy' | 'payAnywayAt' | 'orders'> & {
  payAnywayReason: string | null
  payAnywayBy: string | null
  payAnywayAt: string | null
  orders: WayOrder[]
}

export type WayFilters = NonNullable<operations['WaysController_list_v1']['parameters']['query']>
export type CreateWayBody = components['schemas']['CreateWayDto']
export type MoveWayOrdersBody = components['schemas']['MoveWayOrdersDto']
export type PayWayAnywayBody = components['schemas']['PayWayAnywayDto']
export type CommissionRate = components['schemas']['CommissionRateResponseDto']
export type CommissionRateBody = components['schemas']['UpdateCommissionRateDto']

export const wayKeys = {
  all: ['ways'] as const,
  list: (filters: WayFilters) => ['ways', 'list', filters] as const,
  detail: (wayId: string) => ['ways', 'detail', wayId] as const,
  commissionRate: ['ways', 'commission-rate'] as const,
}

export async function fetchWays(filters: WayFilters = {}): Promise<Way[]> {
  return (await http.get<Way[]>('/ways', { params: filters })).data
}

export async function fetchWay(wayId: string): Promise<WayDetail> {
  return (await http.get<WayDetail>(`/ways/${wayId}`)).data
}

export async function createWay(body: CreateWayBody): Promise<Way> {
  return (await http.post<Way>('/ways', body)).data
}

export async function closeWay(wayId: string): Promise<Way> {
  return (await http.post<Way>(`/ways/${wayId}/close`)).data
}

export async function moveWayOrders(wayId: string, body: MoveWayOrdersBody): Promise<WayDetail> {
  return (await http.post<WayDetail>(`/ways/${wayId}/move-orders`, body)).data
}

export async function payWayAnyway(wayId: string, body: PayWayAnywayBody): Promise<Way> {
  return (await http.post<Way>(`/ways/${wayId}/pay-anyway`, body)).data
}

export async function fetchCommissionRate(): Promise<CommissionRate> {
  return (await http.get<CommissionRate>('/ways/settings/commission-per-way')).data
}

export async function updateCommissionRate(body: CommissionRateBody): Promise<CommissionRate> {
  return (await http.put<CommissionRate>('/ways/settings/commission-per-way', body)).data
}
