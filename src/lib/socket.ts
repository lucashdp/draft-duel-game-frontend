import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'
import { refreshOnce } from '@/lib/api'
import {
  WsErrorCode,
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
// Whether we've already tried an auth refresh since the last successful connect.
// Reset on every `connect` so a fresh drop gets one refresh attempt, but a
// still-rejected handshake after refreshing stops the retry loop.
let authRefreshTried = false

export function getSocket(): Socket {
  if (!socket) {
    socket = io(env.NEXT_PUBLIC_WS_URL, {
      withCredentials: true,
      autoConnect: false,
      // Connect via HTTP long-polling first, then transparently upgrade to raw
      // WebSocket once it's confirmed working. Mobile networks, captive portals
      // and corporate proxies frequently block WebSocket; polling-first means
      // the socket still connects there (staying on polling) — that's the
      // instability that reproduced on phones but not desktop. WebSocket-first
      // would NOT fall back without `tryAllTransports: true` (engine.io-client
      // `_onError` only shifts transport when that flag is set), so the upgrade
      // path is the reliable fix. Single Railway replica → polling needs no
      // sticky sessions.
      transports: ['polling', 'websocket'],
    })

    socket.on('connect', () => {
      authRefreshTried = false
    })

    // The socket is authenticated once, at the handshake, from the short-lived
    // (15 min) access cookie. When it expires, a (re)connect is rejected with
    // UNAUTHORIZED and socket.io would otherwise retry forever with the same
    // stale cookie — a permanently-dead, silent socket until a full page reload.
    // Refresh the cookie once, then reconnect; if it still fails, stop retrying.
    socket.on('connect_error', (err: Error) => {
      // Match the backend's explicit error contract: the WS auth middleware
      // (`ws-auth.middleware.ts`) rejects an expired-cookie handshake with a
      // structured `err.data.code = 'UNAUTHORIZED'`, which socket.io propagates
      // on `connect_error`. Keying off that field instead of the human-readable
      // message keeps us decoupled from message wording (which can change/be
      // localized) and ignores transport errors (xhr poll error, etc.).
      const code = (err as { data?: { code?: string } }).data?.code
      if (code !== WsErrorCode.UNAUTHORIZED) return
      if (authRefreshTried) {
        socket?.disconnect()
        return
      }
      authRefreshTried = true
      // Timing assumption re: socket.io's built-in auto-reconnect (on by
      // default). refreshOnce() (~200ms) normally resolves before the Manager's
      // first auto-retry (`reconnectionDelay` ~1s), so our reconnect below runs
      // with the fresh cookie. If a slow refresh loses that race, the auto-retry
      // hits another UNAUTHORIZED and the guard above disconnects — but the
      // `.then()` reconnect then re-attempts with the refreshed cookie, so
      // recovery still converges (just one extra round-trip).
      refreshOnce()
        .then(() => socket?.connect())
        .catch(() => socket?.disconnect())
    })
  }
  return socket
}

export function connectSocket(): void {
  refCount += 1
  getSocket().connect()
}

/** Whether the shared socket currently has an open connection. */
export function isSocketConnected(): boolean {
  return Boolean(socket?.connected)
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

/**
 * Run `handler` on every (re)connect of the shared socket. A reconnected socket
 * is a brand-new server-side socket that is NOT in any room channel, so room
 * consumers must re-emit `room:join` here — otherwise the page goes silent
 * (no draft/match broadcasts) until a slow REST poll heals it. Returns an
 * unsubscribe function.
 */
export function socketOnConnect(handler: () => void): () => void {
  const sock = getSocket()
  sock.on('connect', handler)
  return () => {
    sock.off('connect', handler)
  }
}
