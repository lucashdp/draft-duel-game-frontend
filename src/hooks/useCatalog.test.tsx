import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useChampionships,
  useCurrentRound,
  useMatch,
  useMatchLineups,
} from './useCatalog'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const sampleTeam = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
  position: 1, form: [],
}

describe('useChampionships', () => {
  it('fetches and parses the championships list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [
      { id: '00000000-0000-4000-8000-000000000001', slug: 'brasileirao', name: 'Brasileirão', kind: 'league' },
    ]))
    const { result } = renderHook(() => useChampionships(), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].slug).toBe('brasileirao')
  })
})

describe('useCurrentRound', () => {
  it('fetches and parses the current round for a slug', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      championship: { id: '00000000-0000-4000-8000-000000000001', slug: 'brasileirao', name: 'B', kind: 'league' },
      round: { id: '00000000-0000-4000-8000-000000000002', number: 1, name: 'R1', startsAt: null, endsAt: null },
      matches: [],
    }))
    const { result } = renderHook(() => useCurrentRound('brasileirao'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.round.number).toBe(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/championships/brasileirao/current-round')
  })
})

describe('useMatch', () => {
  it('fetches and parses a match by id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      id: '00000000-0000-4000-8000-000000000010',
      championshipId: '00000000-0000-4000-8000-000000000001',
      kickoffAt: '2026-05-20T18:00:00.000Z',
      status: 'scheduled',
      homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
      venue: null,
      homeTeam: sampleTeam,
      awayTeam: { ...sampleTeam, id: '00000000-0000-4000-8000-000000000021', name: 'B', abbreviation: 'BBB' },
    }))
    const { result } = renderHook(() => useMatch('00000000-0000-4000-8000-000000000010'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.status).toBe('scheduled')
  })
})

describe('useMatchLineups', () => {
  it('fetches and parses lineups for a match id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      matchId: '00000000-0000-4000-8000-000000000010',
      confirmedAt: null,
      home: [],
      away: [],
    }))
    const { result } = renderHook(
      () => useMatchLineups('00000000-0000-4000-8000-000000000010'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.home).toEqual([])
  })
})
