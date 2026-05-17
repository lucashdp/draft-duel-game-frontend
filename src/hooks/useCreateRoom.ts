'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, { matchId: string }>({
    mutationFn: async (input) =>
      roomSnapshotSchema.parse(await api.post('/rooms', input)),
    onSuccess: (snapshot) => {
      qc.setQueryData(['room', snapshot.id], snapshot)
      qc.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
