import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserStatusValue } from '@/lib/constants/user-status'
import { http } from '@/lib/api/client'
import { usersKeys } from '@/features/users/api'
import type { components } from '@/types/api'

export type Rider = components['schemas']['RiderResponseDto']
type RiderList = components['schemas']['RiderListResponseDto']
export type RiderVehicleType = components['schemas']['RiderVehicleType']
export type AssignableRider = components['schemas']['AssignableRiderResponseDto']

/**
 * The `perPage` ceiling on `GET /riders` — its query DTO caps the value at 100.
 *
 * Anything that needs the whole fleet in one request is bounded by this, which is
 * why it is named rather than written as `100` at each call site: a list that
 * silently stops part-way looks complete.
 */
export const RIDER_LIST_MAX_PER_PAGE = 100

/**
 * Explicit DTOs. Codegen stubs the nullable strings as `Record<string, never>`;
 * the backend files `string | null`. These give mutation bodies proper types
 * without casting to `any`.
 *
 * Create provisions a backing user row (name/email/password feed the users
 * table). Update is a combined PATCH — it may touch the rider row AND the user
 * row — so we never send email/password/roleId here.
 */
export interface CreateRiderBody {
  name: string
  email: string
  password: string
  phone?: string | null
  status?: UserStatusValue
  licenseNo?: string | null
  vehicleType: RiderVehicleType
  vehiclePlate?: string | null
  nrcNumber?: string | null
  emergencyContactPhone?: string | null
  notes?: string | null
}

export interface UpdateRiderBody {
  name?: string
  phone?: string | null
  status?: UserStatusValue
  licenseNo?: string | null
  vehicleType?: RiderVehicleType
  vehiclePlate?: string | null
  nrcNumber?: string | null
  emergencyContactPhone?: string | null
  notes?: string | null
}

export interface RidersFilters {
  page: number
  perPage: number
  search?: string
  status?: UserStatusValue
}

export const ridersKeys = {
  all: ['riders'] as const,
  list: (filters: RidersFilters) => ['riders', 'list', filters] as const,
  assignable: ['riders', 'assignable'] as const,
}

/* ---- API functions ---- */

export async function fetchRiders(
  filters: RidersFilters,
): Promise<RiderList> {
  const response = await http.get<RiderList>('/riders', { params: filters })
  return response.data
}

export async function fetchAssignableRiders(): Promise<AssignableRider[]> {
  const response = await http.get<AssignableRider[]>('/riders/assignable')
  return response.data
}

export async function createRider(body: CreateRiderBody): Promise<Rider> {
  const response = await http.post<Rider>('/riders', body)
  return response.data
}

export async function updateRider(
  id: string,
  body: UpdateRiderBody,
): Promise<Rider> {
  const response = await http.patch<Rider>(`/riders/${id}`, body)
  return response.data
}

export async function deleteRider(id: string): Promise<void> {
  await http.delete(`/riders/${id}`)
}

/* ---- Hooks ---- */

export function useRiders(filters: RidersFilters) {
  return useQuery({
    queryKey: ridersKeys.list(filters),
    queryFn: () => fetchRiders(filters),
  })
}

/**
 * Active riders eligible for office order assignment. Backs the order create
 * form's rider selector; requires `orders.create`. The list is independent of
 * the selected township.
 *
 * Pass `enabled: false` where the list is only needed behind an interaction
 * (the assign dialog fetches riders only once the user picks that type).
 */
export function useAssignableRiders(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ridersKeys.assignable,
    queryFn: fetchAssignableRiders,
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  })
}

export function useCreateRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRider,
    onSuccess: () => {
      // A rider creates a backing user row → both lists stale.
      queryClient.invalidateQueries({ queryKey: ridersKeys.all })
      queryClient.invalidateQueries({ queryKey: usersKeys.all })
    },
  })
}

export function useUpdateRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRiderBody }) =>
      updateRider(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ridersKeys.all })
      queryClient.invalidateQueries({ queryKey: usersKeys.all })
    },
  })
}

export function useDeleteRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteRider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ridersKeys.all })
      queryClient.invalidateQueries({ queryKey: usersKeys.all })
    },
  })
}
