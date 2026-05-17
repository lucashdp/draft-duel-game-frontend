import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

interface Props {
  room: RoomSnapshotDto
}

export function PendingView({ room }: Props) {
  return (
    <div className="space-y-2 rounded-lg border bg-surface p-6 text-center">
      <p className="text-sm uppercase tracking-wider text-muted-foreground">
        Sala #{room.code}
      </p>
      <h2 className="text-xl font-medium">Em breve: Draft</h2>
      <p className="text-sm text-muted-foreground">
        A próxima vertical do Draft Duel vai habilitar a fase de seleção dos atletas
        nesta sala. Status atual: {room.status}.
      </p>
    </div>
  )
}
