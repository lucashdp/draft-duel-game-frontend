import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMyRooms } from './useMyRooms'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useMyRooms', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('fetches /me/rooms with no filter and parses the response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ active: [], finished: [] })
    const { result } = renderHook(() => useMyRooms(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith('/me/rooms')
    expect(result.current.data?.active).toEqual([])
  })

  it('passes ?status=active when filter provided', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ active: [], finished: [] })
    renderHook(() => useMyRooms('active'), { wrapper: wrapper() })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/me/rooms?status=active')
  })
})
