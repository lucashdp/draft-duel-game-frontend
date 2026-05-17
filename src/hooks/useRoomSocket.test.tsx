import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { EventEmitter } from 'node:events'
import { useRoomSocket } from './useRoomSocket'

const sockEvents = new EventEmitter()
const sock = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    sockEvents.on(event, handler)
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    sockEvents.off(event, handler)
  }),
  emit: vi.fn((event: string, payload: unknown, ack?: (resp: unknown) => void) => {
    if (event === 'room:join' && ack) {
      ack({ id: 'r-1', code: 'K7M2QH', status: 'waiting' })
    }
  }),
}

vi.mock('@/lib/socket', () => ({
  getSocket: () => sock,
  connectSocket: () => sock.connect(),
  disconnectSocket: () => sock.disconnect(),
  socketEmit: (event: string, payload: unknown, ack?: (r: unknown) => void) =>
    sock.emit(event, payload, ack),
  socketOn: (event: string, handler: (payload: unknown) => void) => {
    sock.on(event, handler as (...args: unknown[]) => void)
    return () => sock.off(event, handler as (...args: unknown[]) => void)
  },
}))

function wrapper() {
  const qc = new QueryClient()
  return {
    qc,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

describe('useRoomSocket', () => {
  beforeEach(() => {
    sock.connect.mockClear()
    sock.disconnect.mockClear()
    sock.emit.mockClear()
    sock.on.mockClear()
    sock.off.mockClear()
  })

  it('connects and emits room:join on mount, leaves on unmount', () => {
    const { Wrapper } = wrapper()
    const { unmount } = renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    expect(sock.connect).toHaveBeenCalled()
    expect(sock.emit).toHaveBeenCalledWith('room:join', { roomId: 'r-1' }, expect.any(Function))
    unmount()
    expect(sock.emit).toHaveBeenCalledWith('room:leave', { roomId: 'r-1' }, undefined)
    expect(sock.disconnect).toHaveBeenCalled()
  })

  it('updates the TanStack cache when room:guest_joined arrives', () => {
    const { qc, Wrapper } = wrapper()
    qc.setQueryData(['room', 'r-1'], { id: 'r-1', status: 'waiting', guest: null })
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    act(() => {
      sockEvents.emit('room:guest_joined', { guest: { id: 'g', nickname: 'bob' }, status: 'drafting' })
    })
    const cached = qc.getQueryData(['room', 'r-1']) as any
    expect(cached?.status).toBe('drafting')
    expect(cached?.guest).toEqual({ id: 'g', nickname: 'bob' })
  })

  it('updates the cache on room:abandoned', () => {
    const { qc, Wrapper } = wrapper()
    qc.setQueryData(['room', 'r-1'], { id: 'r-1', status: 'drafting', winner: null })
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    act(() => {
      sockEvents.emit('room:abandoned', { by: 'host', winner: 'guest' })
    })
    const cached = qc.getQueryData(['room', 'r-1']) as any
    expect(cached?.status).toBe('finished')
    expect(cached?.winner).toBe('guest')
  })
})
