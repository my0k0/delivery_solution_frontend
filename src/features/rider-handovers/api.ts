import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/api/client'
import type { components } from '@/types/api'

export type RiderHandover = components['schemas']['RiderHandoverResponseDto']
export type RiderHandoverBalance =
  components['schemas']['RiderHandoverBalanceResponseDto']
export type RiderHandoverAuditEntry =
  components['schemas']['RiderHandoverAuditResponseDto']
export type HandoverMethodValue = RiderHandover['method']

type RiderHandoverList = components['schemas']['RiderHandoverListResponseDto']
type RiderHandoverBalanceList =
  components['schemas']['RiderHandoverBalanceListResponseDto']

/**
 * Explicit bodies. Codegen files `note` as `Record<string, never> | null` — a
 * thin stub for `string | null` — so these give the mutations a type worth
 * passing through a form without casting to `any`.
 */
export interface CreateRiderHandoverBody {
  riderId: string
  amount: string
  receivedOn: string
  method: HandoverMethodValue
  note?: string | null
}

export interface UpdateRiderHandoverBody {
  riderId?: string
  amount?: string
  receivedOn?: string
  method?: HandoverMethodValue
  note?: string | null
  /** Required on every correction; it lands on each history row the edit writes. */
  reason: string
}

export interface HandoverFilters {
  page: number
  perPage: number
  riderId?: string
  method?: HandoverMethodValue
  dateFrom?: string
  dateTo?: string
}

export interface HandoverBalanceFilters {
  page: number
  perPage: number
  search?: string
  outstandingOnly?: boolean
}

/**
 * Both tables hang off one root because one mutation moves both: recording cash
 * changes the balance *and* the history, so a save invalidates the whole root
 * rather than a hand-picked list of sub-keys that will drift out of date.
 */
export const riderHandoversKeys = {
  all: ['rider-handovers'] as const,
  list: (filters: HandoverFilters) =>
    [...riderHandoversKeys.all, 'list', filters] as const,
  balances: (filters: HandoverBalanceFilters) =>
    [...riderHandoversKeys.all, 'balances', filters] as const,
  audit: (id: string) => [...riderHandoversKeys.all, 'audit', id] as const,
}

/* ---- API functions ---- */

export async function fetchRiderHandovers(
  filters: HandoverFilters,
): Promise<RiderHandoverList> {
  const response = await http.get<RiderHandoverList>('/rider-handovers', {
    params: filters,
  })
  return response.data
}

export async function fetchRiderHandoverBalances(
  filters: HandoverBalanceFilters,
): Promise<RiderHandoverBalanceList> {
  const response = await http.get<RiderHandoverBalanceList>(
    '/rider-handovers/balances',
    { params: filters },
  )
  return response.data
}

/**
 * A flat list, mirroring `GET /orders/:id/audit`: a single row's field history is
 * short, and paginating it would be structure without a reason.
 */
export async function fetchRiderHandoverAudit(
  id: string,
): Promise<RiderHandoverAuditEntry[]> {
  const response = await http.get<RiderHandoverAuditEntry[]>(
    `/rider-handovers/${id}/audit`,
  )
  return response.data
}

export async function createRiderHandover(
  body: CreateRiderHandoverBody,
): Promise<RiderHandover> {
  const response = await http.post<RiderHandover>('/rider-handovers', body)
  return response.data
}

export async function updateRiderHandover(
  id: string,
  body: UpdateRiderHandoverBody,
): Promise<RiderHandover> {
  const response = await http.patch<RiderHandover>(`/rider-handovers/${id}`, body)
  return response.data
}

/* ---- hooks ---- */

export function useRiderHandovers(filters: HandoverFilters) {
  return useQuery({
    queryKey: riderHandoversKeys.list(filters),
    queryFn: () => fetchRiderHandovers(filters),
  })
}

export function useRiderHandoverBalances(filters: HandoverBalanceFilters) {
  return useQuery({
    queryKey: riderHandoversKeys.balances(filters),
    queryFn: () => fetchRiderHandoverBalances(filters),
  })
}

/**
 * The caller mounts this only for an expanded row, so there is no nullable id to
 * narrow and no request is spent on history nobody asked for.
 */
export function useRiderHandoverAudit(id: string) {
  return useQuery({
    queryKey: riderHandoversKeys.audit(id),
    queryFn: () => fetchRiderHandoverAudit(id),
  })
}

/**
 * A discriminated union rather than one loose body type: create and correct send
 * different payloads (`reason` exists only on a correction), and this way the
 * branch that picks the payload is the branch that types it — no assertion.
 */
export type SaveRiderHandoverVariables =
  | { id: string; body: UpdateRiderHandoverBody }
  | { id?: undefined; body: CreateRiderHandoverBody }

/** One mutation for both modes, the way the record/correct dialog is one dialog. */
export function useSaveRiderHandover() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: SaveRiderHandoverVariables) =>
      variables.id !== undefined
        ? updateRiderHandover(variables.id, variables.body)
        : createRiderHandover(variables.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: riderHandoversKeys.all })
    },
  })
}
