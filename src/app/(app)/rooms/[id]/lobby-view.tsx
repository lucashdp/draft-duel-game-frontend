'use client'

import type { RoomSnapshotDto } from '@/lib/contracts/rooms'
import { InviteLinkCard } from '@/components/rooms/InviteLinkCard'
import { OpponentSlot } from '@/components/rooms/OpponentSlot'
import { MatchSummary } from '@/components/rooms/MatchSummary'
import { RoomActions } from '@/components/rooms/RoomActions'

interface Props {
  room: RoomSnapshotDto
  isHost: boolean
}

export function LobbyView({ room, isHost }: Props) {
  return (
    <div className="space-y-6">
      <MatchSummary match={room.match} />
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Oponente
        </p>
        <OpponentSlot opponent={room.guest ? { nickname: room.guest.nickname } : null} />
      </div>
      {isHost && <InviteLinkCard code={room.code} />}
      <RoomActions roomId={room.id} showAbandon={isHost} />
    </div>
  )
}
