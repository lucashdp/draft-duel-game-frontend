'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'
import { LOBBY_REFETCH_MS, ROOM_STALE_MS } from '@/constants/rooms'

export function useRoom(roomId: string) {
  return useQuery<RoomSnapshotDto>({
    queryKey: ['room', roomId],
    queryFn: async () => roomSnapshotSchema.parse(await api.get(`/rooms/${roomId}`)),
    enabled: Boolean(roomId),
    staleTime: ROOM_STALE_MS,
    // Safety net in case the WS misses a transition; WS is the primary path.
    refetchInterval: LOBBY_REFETCH_MS,
  })
}
