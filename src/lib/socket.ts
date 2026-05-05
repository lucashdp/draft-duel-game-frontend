import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'

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
