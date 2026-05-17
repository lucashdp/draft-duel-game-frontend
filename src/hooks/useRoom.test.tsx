import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRoom } from './useRoom'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const fakeRoom = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    id: '00000000-0000-4000-8000-000000000010',
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { id: 'th', name: 'F', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { id: 'ta', name: 'P', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { id: '00000000-0000-4000-8000-0000000000a0', nickname: 'alice' },
  guest: null,
  winner: null,
  expiresAt: '2026-05-18T20:00:00.000Z',
  createdAt: '2026-05-17T10:00:00.000Z',
}

describe('useRoom', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('fetches /rooms/:id and parses the response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(fakeRoom)
    const { result } = renderHook(() => useRoom(fakeRoom.id), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith(`/rooms/${fakeRoom.id}`)
    expect(result.current.data?.code).toBe('K7M2QH')
  })

  it('skips query when roomId is empty', () => {
    const { result } = renderHook(() => useRoom(''), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })
})
