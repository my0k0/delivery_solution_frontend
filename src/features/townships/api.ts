import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/api/client'
import type { components } from '@/types/api'

export type Township = components['schemas']['TownshipResponseDto']
/**
 * Codegen DTOs rather than hand-written bodies: `CreateTownshipDto.leadTimeDays`
 * is required, and routing the body through this type turns omitting it into a
 * compile error instead of a runtime 400.
 */
export type CreateTownshipBody = components['schemas']['CreateTownshipDto']
export type UpdateTownshipBody = components['schemas']['UpdateTownshipDto']

export const townshipsKeys = {
  all: ['townships'] as const,
}

export async function fetchTownships(): Promise<Township[]> {
  const response = await http.get<Township[]>('/townships')
  return response.data
}

export async function createTownship(body: CreateTownshipBody): Promise<Township> {
  const response = await http.post<Township>('/townships', body)
  return response.data
}

export async function updateTownship(id: string, body: UpdateTownshipBody): Promise<Township> {
  const response = await http.patch<Township>(`/townships/${id}`, body)
  return response.data
}

export async function deleteTownship(id: string): Promise<void> {
  await http.delete(`/townships/${id}`)
}

export function useTownships() {
  return useQuery({
    queryKey: townshipsKeys.all,
    queryFn: fetchTownships,
    staleTime: 30_000,
  })
}

export function useSaveTownship() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CreateTownshipBody }) =>
      id ? updateTownship(id, body) : createTownship(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: townshipsKeys.all })
    },
  })
}

export function useDeleteTownship() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTownship,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: townshipsKeys.all })
    },
  })
}
