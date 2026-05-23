import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMakePick } from './useMakePick'

const emitImpl = vi.fn<(event: string, payload: unknown, ack?: (resp: unknown) => void) => void>()

vi.mock('@/lib/socket', () => ({
  socketEmit: (event: string, payload: unknown, ack?: (resp: unknown) => void) =>
    emitImpl(event, payload, ack),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const ROOM_ID = '00000000-0000-4000-8000-000000000001'
const ATH_ID = '00000000-0000-4000-8000-000000000002'

describe('useMakePick', () => {
  beforeEach(() => emitImpl.mockReset())

  it('emits draft:pick with the right payload and resolves on ack ok', async () => {
    emitImpl.mockImplementation((_e, _p, ack) => {
      ack?.({ ok: true })
    })
    const { result } = renderHook(() => useMakePick(ROOM_ID), { wrapper })
    result.current.mutate({ pickNumber: 0, athleteId: ATH_ID })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(emitImpl).toHaveBeenCalledWith(
      'draft:pick',
      { roomId: ROOM_ID, pickNumber: 0, athleteId: ATH_ID },
      expect.any(Function),
    )
  })

  it('rejects with the error code when ack returns an error shape', async () => {
    emitImpl.mockImplementation((_e, _p, ack) => {
      ack?.({ error: { code: 'NOT_YOUR_TURN', message: 'nope' } })
    })
    const { result } = renderHook(() => useMakePick(ROOM_ID), { wrapper })
    result.current.mutate({ pickNumber: 0, athleteId: ATH_ID })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error & { code?: string })?.code).toBe('NOT_YOUR_TURN')
  })

  it('rejects with UNKNOWN if the ack never arrives (timeout)', async () => {
    vi.useFakeTimers()
    try {
      emitImpl.mockImplementation(() => {
        // Never invoke the ack — simulate a dropped response.
      })
      const { result } = renderHook(() => useMakePick(ROOM_ID), { wrapper })
      result.current.mutate({ pickNumber: 0, athleteId: ATH_ID })
      await vi.advanceTimersByTimeAsync(5000)
      await vi.waitFor(() => expect(result.current.isError).toBe(true))
      expect((result.current.error as Error & { code?: string })?.code).toBe('UNKNOWN')
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects with UNKNOWN if the ack payload is malformed', async () => {
    emitImpl.mockImplementation((_e, _p, ack) => {
      ack?.({ wat: 'not a valid ack' })
    })
    const { result } = renderHook(() => useMakePick(ROOM_ID), { wrapper })
    result.current.mutate({ pickNumber: 0, athleteId: ATH_ID })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error & { code?: string })?.code).toBe('UNKNOWN')
  })
})
