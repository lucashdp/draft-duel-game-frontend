'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  connectSocket,
  disconnectSocket,
  socketEmit,
  socketOn,
} from '@/lib/socket'
import {
  WsClientEvent,
  WsServerEvent,
  type RoomGuestJoinedPayload,
  type RoomAbandonedPayload,
} from '@/lib/contracts/ws'
import {
  RoomStatus,
  roomSnapshotSchema,
  type RoomSnapshotDto,
} from '@/lib/contracts/rooms'

export function useRoomSocket(roomId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!roomId) return

    connectSocket()

    const handleState = (raw: unknown) => {
      const parsed = roomSnapshotSchema.safeParse(raw)
      if (parsed.success) {
        queryClient.setQueryData(['room', roomId], parsed.data)
      }
    }

    const handleGuestJoined = (payload: RoomGuestJoinedPayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return { ...prev, status: payload.status, guest: payload.guest }
      })
    }

    const handleAbandoned = (payload: RoomAbandonedPayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return { ...prev, status: RoomStatus.FINISHED, winner: payload.winner }
      })
    }

    const offState = socketOn<unknown>(WsServerEvent.ROOM_STATE, handleState)
    const offGuestJoined = socketOn<RoomGuestJoinedPayload>(
      WsServerEvent.ROOM_GUEST_JOINED,
      handleGuestJoined,
    )
    const offAbandoned = socketOn<RoomAbandonedPayload>(
      WsServerEvent.ROOM_ABANDONED,
      handleAbandoned,
    )

    socketEmit<{ roomId: string }>(WsClientEvent.ROOM_JOIN, { roomId }, (snapshot) => {
      handleState(snapshot)
    })

    return () => {
      offState()
      offGuestJoined()
      offAbandoned()
      socketEmit<{ roomId: string }>(WsClientEvent.ROOM_LEAVE, { roomId })
      disconnectSocket()
    }
  }, [queryClient, roomId])
}
