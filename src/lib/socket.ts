import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'
import {
  type WsClientEvent,
  type WsServerEvent,
} from '@/lib/contracts/ws'

/**
 * Max time (ms) we wait for an emit ack before giving up. Shared across all
 * ack-bearing emits (draft:pick, match:substitute, …) — spec budgets
 * propagation at `< 2s`, so 5s leaves room for slow networks without leaving
 * a confirmation dialog spinning indefinitely.
 */
export const ACK_TIMEOUT_MS = 5000

let socket: Socket | null = null
// Refcount so multiple consumers (lobby + future draft/match views) can share
// one socket. Last consumer to call disconnectSocket() actually disconnects.
let refCount = 0

export function getSocket(): Socket {
  if (!socket) {
    socket = io(env.NEXT_PUBLIC_WS_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket'],
    })
  }
  return socket
}

export function connectSocket(): void {
  refCount += 1
  getSocket().connect()
}

export function disconnectSocket(): void {
  if (refCount > 0) refCount -= 1
  if (refCount === 0 && socket) {
    socket.disconnect()
    socket = null
  }
}

/** Typed wrapper around socket.emit so handlers can be searched by enum value. */
export function socketEmit<T>(event: WsClientEvent, payload: T, ack?: (resp: unknown) => void): void {
  if (ack) {
    getSocket().emit(event, payload, ack)
  } else {
    getSocket().emit(event, payload)
  }
}

/** Subscribe to a server event. Returns an unsubscribe function. */
export function socketOn<T>(event: WsServerEvent, handler: (payload: T) => void): () => void {
  const sock = getSocket()
  sock.on(event, handler as (...args: unknown[]) => void)
  return () => {
    sock.off(event, handler as (...args: unknown[]) => void)
  }
}
