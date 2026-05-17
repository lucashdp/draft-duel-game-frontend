'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  championshipSchema,
  currentRoundSchema,
  matchLineupsSchema,
  matchSummarySchema,
  type ChampionshipDto,
  type CurrentRoundDto,
  type MatchLineupsDto,
  type MatchSummaryDto,
} from '@/lib/contracts/catalog'
import { z } from 'zod'

const championshipsSchema = z.array(championshipSchema)

export function useChampionships() {
  return useQuery<ChampionshipDto[]>({
    queryKey: ['championships'],
    queryFn: async () => championshipsSchema.parse(await api.get('/championships')),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCurrentRound(slug: string) {
  return useQuery<CurrentRoundDto>({
    queryKey: ['championship', slug, 'current-round'],
    queryFn: async () =>
      currentRoundSchema.parse(
        await api.get(`/championships/${encodeURIComponent(slug)}/current-round`),
      ),
    enabled: !!slug,
    staleTime: 60 * 1000,
  })
}

export function useMatch(id: string) {
  return useQuery<MatchSummaryDto>({
    queryKey: ['match', id],
    queryFn: async () =>
      matchSummarySchema.parse(await api.get(`/matches/${encodeURIComponent(id)}`)),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export function useMatchLineups(id: string) {
  return useQuery<MatchLineupsDto>({
    queryKey: ['match', id, 'lineups'],
    queryFn: async () =>
      matchLineupsSchema.parse(await api.get(`/matches/${encodeURIComponent(id)}/lineups`)),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}
