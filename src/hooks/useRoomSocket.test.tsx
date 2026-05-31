import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { EventEmitter } from 'node:events'
import { useRoomSocket } from './useRoomSocket'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

const sockEvents = new EventEmitter()
const sock = {
  connected: false,
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
  isSocketConnected: () => sock.connected,
  socketEmit: (event: string, payload: unknown, ack?: (r: unknown) => void) =>
    sock.emit(event, payload, ack),
  socketOn: (event: string, handler: (payload: unknown) => void) => {
    sock.on(event, handler as (...args: unknown[]) => void)
    return () => sock.off(event, handler as (...args: unknown[]) => void)
  },
  socketOnConnect: (handler: () => void) => {
    sock.on('connect', handler as (...args: unknown[]) => void)
    return () => sock.off('connect', handler as (...args: unknown[]) => void)
  },
}))

describe('useRoomSocket', () => {
  beforeEach(() => {
    sock.connected = false
    sock.connect.mockClear()
    sock.disconnect.mockClear()
    sock.emit.mockClear()
    sock.on.mockClear()
    sock.off.mockClear()
  })

  it('connects and joins eagerly when mounted over an already-open socket', () => {
    // Already-connected consumer (e.g. a second view, or a remount over a live
    // connection): `connect` won't fire again, so the join must happen eagerly.
    sock.connected = true
    const qc = new QueryClient()
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    }
    const { unmount } = renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    expect(sock.connect).toHaveBeenCalled()
    expect(sock.emit).toHaveBeenCalledWith('room:join', { roomId: 'r-1' }, expect.any(Function))
    unmount()
    expect(sock.emit).toHaveBeenCalledWith('room:leave', { roomId: 'r-1' }, undefined)
    expect(sock.disconnect).toHaveBeenCalled()
  })

  it('does not eagerly join a cold socket — it joins once on the first connect', () => {
    const qc = new QueryClient()
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    }
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })

    const joinCount = () =>
      sock.emit.mock.calls.filter((c) => c[0] === 'room:join').length
    // Cold socket: no eager join (socket.io would buffer + flush it on connect,
    // double-firing alongside the connect handler).
    expect(joinCount()).toBe(0)

    // First connect performs exactly one join, not two.
    act(() => {
      sockEvents.emit('connect')
    })
    expect(joinCount()).toBe(1)
  })

  it('updates the TanStack cache when room:guest_joined arrives', () => {
    const qc = new QueryClient()
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    }
    qc.setQueryData(['room', 'r-1'], { id: 'r-1', status: 'waiting', guest: null })
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    act(() => {
      sockEvents.emit('room:guest_joined', { guest: { id: 'g', nickname: 'bob' }, status: 'drafting' })
    })
    const cached = qc.getQueryData<RoomSnapshotDto>(['room', 'r-1'])
    expect(cached?.status).toBe('drafting')
    expect(cached?.guest).toEqual({ id: 'g', nickname: 'bob' })
  })

  it('re-emits room:join when the socket reconnects', () => {
    const qc = new QueryClient()
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    }
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })

    const joinCount = () =>
      sock.emit.mock.calls.filter((c) => c[0] === 'room:join').length
    // First connect joins once.
    act(() => {
      sockEvents.emit('connect')
    })
    expect(joinCount()).toBe(1)

    // A reconnected socket starts outside the room channel — the hook must
    // re-join, otherwise the room goes silent after the drop.
    act(() => {
      sockEvents.emit('connect')
    })
    expect(joinCount()).toBe(2)
  })

  it('updates the cache on room:abandoned', () => {
    const qc = new QueryClient()
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    }
    qc.setQueryData(['room', 'r-1'], { id: 'r-1', status: 'drafting', winner: null })
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    act(() => {
      sockEvents.emit('room:abandoned', { by: 'host', winner: 'guest' })
    })
    const cached = qc.getQueryData<RoomSnapshotDto>(['room', 'r-1'])
    expect(cached?.status).toBe('finished')
    expect(cached?.winner).toBe('guest')
  })
})
