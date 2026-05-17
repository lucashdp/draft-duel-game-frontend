'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useAbandonRoom() {
  const qc = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, { roomId: string }>({
    mutationFn: async ({ roomId }) =>
      roomSnapshotSchema.parse(await api.post(`/rooms/${roomId}/abandon`)),
    onSuccess: (snapshot) => {
      qc.setQueryData(['room', snapshot.id], snapshot)
      qc.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
