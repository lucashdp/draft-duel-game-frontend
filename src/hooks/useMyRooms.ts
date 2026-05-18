'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { myRoomsResponseSchema, type MyRoomsResponseDto } from '@/lib/contracts/rooms'

export function useMyRooms(filter?: 'active' | 'finished') {
  const path = filter ? `/me/rooms?status=${filter}` : '/me/rooms'
  return useQuery<MyRoomsResponseDto>({
    queryKey: ['me', 'rooms', filter ?? 'all'],
    queryFn: async () => myRoomsResponseSchema.parse(await api.get(path)),
  })
}
