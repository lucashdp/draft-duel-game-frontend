'use client'

import { use } from 'react'
import { useRoom } from '@/hooks/useRoom'
import { useRoomSocket } from '@/hooks/useRoomSocket'
import { useAuth } from '@/hooks/useAuth'
import { RoomStatus } from '@/lib/contracts/rooms'
import { LobbyView } from './lobby-view'
import { DraftView } from './draft-view'
import { PendingView } from './pending-view'

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const room = useRoom(id)
  const { user } = useAuth()
  useRoomSocket(id)

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      {room.isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}
      {room.isError && (
        <p className="text-event-negative text-sm">Não foi possível carregar a sala.</p>
      )}
      {room.data && (() => {
        const isHost = user?.id === room.data.host.id
        if (room.data.status === RoomStatus.WAITING) {
          return <LobbyView room={room.data} isHost={isHost} />
        }
        if (room.data.status === RoomStatus.DRAFTING) {
          return <DraftView room={room.data} isHost={isHost} />
        }
        return <PendingView room={room.data} />
      })()}
    </main>
  )
}
