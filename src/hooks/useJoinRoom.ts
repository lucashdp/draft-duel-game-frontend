'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useJoinRoom() {
  const qc = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, { code: string }>({
    mutationFn: async ({ code }) =>
      roomSnapshotSchema.parse(await api.post(`/rooms/${code}/join`)),
    onSuccess: (snapshot) => {
      qc.setQueryData(['room', snapshot.id], snapshot)
      qc.invalidateQueries({ queryKey: ['room-preview', snapshot.code] })
      qc.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
