import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'
import {
  type WsClientEvent,
  type WsServerEvent,
} from '@/lib/contracts/ws'

let socket: Socket | null = null

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
  getSocket().connect()
}

export function disconnectSocket(): void {
  if (socket) {
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
