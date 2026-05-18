'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useJoinRoom() {
  const queryClient = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, { code: string }>({
    mutationFn: async ({ code }) =>
      roomSnapshotSchema.parse(await api.post(`/rooms/${code}/join`)),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(['room', snapshot.id], snapshot)
      queryClient.invalidateQueries({ queryKey: ['room-preview', snapshot.code] })
      queryClient.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
