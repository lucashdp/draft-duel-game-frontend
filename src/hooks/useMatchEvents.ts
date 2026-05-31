'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { matchEventsResponseSchema, type MatchEventsResponseDto } from '@/lib/contracts/matchEvents'

export function useMatchEvents(id: string, enabled: boolean) {
  return useQuery<MatchEventsResponseDto>({
    queryKey: ['match', id, 'events'],
    queryFn: async () =>
      matchEventsResponseSchema.parse(await api.get(`/matches/${encodeURIComponent(id)}/events`)),
    enabled: !!id && enabled,
    staleTime: 30 * 1000,
  })
}
