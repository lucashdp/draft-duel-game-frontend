import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAbandonRoom } from './useAbandonRoom'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useAbandonRoom', () => {
  beforeEach(() => vi.mocked(api.post).mockReset())

  it('POSTs /rooms/:id/abandon', async () => {
    const fakeSnapshot = {
      id: '00000000-0000-4000-8000-000000000001',
      code: 'K7M2QH',
      status: 'finished',
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
    vi.mocked(api.post).mockResolvedValueOnce(fakeSnapshot)
    const { result } = renderHook(() => useAbandonRoom(), { wrapper: wrapper() })
    result.current.mutate({ roomId: fakeSnapshot.id })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.post).toHaveBeenCalledWith(`/rooms/${fakeSnapshot.id}/abandon`)
    expect(result.current.data?.status).toBe('finished')
  })
})
