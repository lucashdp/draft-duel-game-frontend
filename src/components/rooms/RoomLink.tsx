import Link from 'next/link'
import { Role, type RoomSummaryDto } from '@/lib/contracts/rooms'
import { formatRoomStatus } from '@/lib/format-room'

interface Props {
  room: RoomSummaryDto
}

export function RoomLink({ room }: Props) {
  return (
    <li>
      <Link
        href={`/rooms/${room.id}`}
        className="block rounded-md border bg-surface px-3 py-2 hover:border-primary"
      >
        <p className="text-sm font-medium">
          {room.match.homeTeam.name} × {room.match.awayTeam.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {room.role === Role.HOST ? 'Anfitrião' : 'Convidado'} ·{' '}
          {room.opponent?.nickname ?? '—'} · {formatRoomStatus(room.status)}
        </p>
      </Link>
    </li>
  )
}
