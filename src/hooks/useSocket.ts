'use client'

import { useEffect, useRef } from 'react'
import { type Socket } from 'socket.io-client'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'

export function useSocket(): Socket {
  const socketRef = useRef<Socket>(getSocket())

  useEffect(() => {
    connectSocket()
    return () => {
      disconnectSocket()
    }
  }, [])

  return socketRef.current
}
