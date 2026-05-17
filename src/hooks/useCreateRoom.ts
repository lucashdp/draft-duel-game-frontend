'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  createRoomRequestSchema,
  roomSnapshotSchema,
  type CreateRoomRequest,
  type RoomSnapshotDto,
} from '@/lib/contracts/rooms'

export function useCreateRoom() {
  const queryClient = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, CreateRoomRequest>({
    mutationFn: async (input) =>
      roomSnapshotSchema.parse(
        await api.post('/rooms', createRoomRequestSchema.parse(input)),
      ),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(['room', snapshot.id], snapshot)
      queryClient.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
