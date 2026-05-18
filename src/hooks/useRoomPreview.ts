'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomPreviewSchema, type RoomPreviewDto } from '@/lib/contracts/rooms'

export function useRoomPreview(code: string) {
  return useQuery<RoomPreviewDto>({
    queryKey: ['room-preview', code],
    queryFn: async () => roomPreviewSchema.parse(await api.get(`/rooms/by-code/${code}/preview`)),
    enabled: Boolean(code),
    retry: false,
  })
}
