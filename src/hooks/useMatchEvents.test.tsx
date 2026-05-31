import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMatchEvents } from './useMatchEvents'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMatchEvents', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('busca /matches/:id/events quando enabled', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([])
    const { result } = renderHook(() => useMatchEvents('m-1', true), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith('/matches/m-1/events')
  })

  it('não busca quando enabled=false', () => {
    renderHook(() => useMatchEvents('m-1', false), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })
})
