import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mutable state captured by the socket.io-client / api mocks. Declared via
// vi.hoisted so it exists before the hoisted vi.mock factories run.
const h = vi.hoisted(() => {
  return {
    refreshOnce: vi.fn<() => Promise<void>>(),
    handlers: {} as Record<string, (...args: unknown[]) => void>,
    socket: null as null | {
      connected: boolean
      on: ReturnType<typeof vi.fn>
      off: ReturnType<typeof vi.fn>
      connect: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
      emit: ReturnType<typeof vi.fn>
    },
  }
})

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_WS_URL: 'ws://test', NEXT_PUBLIC_API_URL: 'http://test' } }))
vi.mock('@/lib/api', () => ({ refreshOnce: () => h.refreshOnce() }))
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    h.handlers = {}
    h.socket = {
      connected: false,
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        h.handlers[event] = handler
      }),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
    }
    return h.socket
  }),
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('socket auth recovery on connect_error', () => {
  beforeEach(async () => {
    vi.resetModules()
    h.refreshOnce.mockReset().mockResolvedValue(undefined)
    h.handlers = {}
    h.socket = null
  })

  it('refreshes the access cookie and reconnects on an UNAUTHORIZED handshake', async () => {
    const { getSocket } = await import('./socket')
    getSocket()

    h.handlers['connect_error'](new Error('Unauthorized'))
    expect(h.refreshOnce).toHaveBeenCalledTimes(1)

    await flush()
    expect(h.socket!.connect).toHaveBeenCalledTimes(1)
  })

  it('ignores a non-auth connect error (no refresh, no forced disconnect)', async () => {
    const { getSocket } = await import('./socket')
    getSocket()

    h.handlers['connect_error'](new Error('xhr poll error'))
    expect(h.refreshOnce).not.toHaveBeenCalled()
    expect(h.socket!.disconnect).not.toHaveBeenCalled()
  })

  it('stops retrying (disconnects) when still UNAUTHORIZED after a refresh', async () => {
    const { getSocket } = await import('./socket')
    getSocket()

    h.handlers['connect_error'](new Error('Unauthorized'))
    await flush()
    // Reconnect handshake still rejected, with no successful connect in between.
    h.handlers['connect_error'](new Error('Unauthorized'))

    expect(h.refreshOnce).toHaveBeenCalledTimes(1) // not refreshed a second time
    expect(h.socket!.disconnect).toHaveBeenCalled()
  })

  it('allows a fresh refresh after a successful connect resets the guard', async () => {
    const { getSocket } = await import('./socket')
    getSocket()

    h.handlers['connect_error'](new Error('Unauthorized'))
    await flush()
    h.handlers['connect']() // a good connection resets the one-shot guard
    h.handlers['connect_error'](new Error('Unauthorized'))

    expect(h.refreshOnce).toHaveBeenCalledTimes(2)
  })
})
