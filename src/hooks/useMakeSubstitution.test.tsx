import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMakeSubstitution } from './useMakeSubstitution'

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
const OUT_ID = '00000000-0000-4000-8000-000000000002'
const IN_ID = '00000000-0000-4000-8000-000000000003'

describe('useMakeSubstitution', () => {
  beforeEach(() => emitImpl.mockReset())

  it('emits match:substitute with the right payload and resolves on ack ok', async () => {
    emitImpl.mockImplementation((_e, _p, ack) => {
      ack?.({ ok: true })
    })
    const { result } = renderHook(() => useMakeSubstitution(ROOM_ID), { wrapper })
    result.current.mutate({ removeAthleteId: OUT_ID, addAthleteId: IN_ID })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(emitImpl).toHaveBeenCalledWith(
      'match:substitute',
      { roomId: ROOM_ID, removeAthleteId: OUT_ID, addAthleteId: IN_ID },
      expect.any(Function),
    )
  })

  it('rejects with the error code when ack returns an error shape', async () => {
    emitImpl.mockImplementation((_e, _p, ack) => {
      ack?.({ error: { code: 'ATHLETE_NOT_IN_TEAM', message: 'nope' } })
    })
    const { result } = renderHook(() => useMakeSubstitution(ROOM_ID), { wrapper })
    result.current.mutate({ removeAthleteId: OUT_ID, addAthleteId: IN_ID })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error & { code?: string })?.code).toBe('ATHLETE_NOT_IN_TEAM')
  })

  it('rejects with UNKNOWN if the ack never arrives (timeout)', async () => {
    vi.useFakeTimers()
    try {
      emitImpl.mockImplementation(() => {
        // Never invoke the ack — simulate a dropped response.
      })
      const { result } = renderHook(() => useMakeSubstitution(ROOM_ID), { wrapper })
      result.current.mutate({ removeAthleteId: OUT_ID, addAthleteId: IN_ID })
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
    const { result } = renderHook(() => useMakeSubstitution(ROOM_ID), { wrapper })
    result.current.mutate({ removeAthleteId: OUT_ID, addAthleteId: IN_ID })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error & { code?: string })?.code).toBe('UNKNOWN')
  })
})
