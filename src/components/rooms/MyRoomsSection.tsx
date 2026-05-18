'use client'

import { useMyRooms } from '@/hooks/useMyRooms'
import { RoomLink } from '@/components/rooms/RoomLink'

export function MyRoomsSection() {
  const my = useMyRooms()

  if (my.isLoading) return null
  if (!my.data) return null

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Minhas salas
      </h2>

      {my.data.active.length === 0 && my.data.finished.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem salas. Crie uma na página de uma partida.
        </p>
      )}

      {my.data.active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Ativas</p>
          <ul className="space-y-2">
            {my.data.active.map((room) => (
              <RoomLink key={room.id} room={room} />
            ))}
          </ul>
        </div>
      )}

      {my.data.finished.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Finalizadas</p>
          <ul className="space-y-2">
            {my.data.finished.map((room) => (
              <RoomLink key={room.id} room={room} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
