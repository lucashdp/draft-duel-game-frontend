import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRoomPreview } from './useRoomPreview'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const fakePreview = {
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { name: 'F', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { name: 'P', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { nickname: 'alice' },
  expiresAt: '2026-05-18T20:00:00.000Z',
}

describe('useRoomPreview', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('fetches /rooms/by-code/:code/preview', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(fakePreview)
    const { result } = renderHook(() => useRoomPreview('K7M2QH'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith('/rooms/by-code/K7M2QH/preview')
    expect(result.current.data?.host.nickname).toBe('alice')
  })
})
