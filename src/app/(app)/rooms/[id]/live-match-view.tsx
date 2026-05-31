'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'
import { MatchHeader } from '@/components/live/MatchHeader'
import { ScoreboardCards } from '@/components/live/ScoreboardCards'
import { TeamLineup } from '@/components/live/TeamLineup'
import { MatchTimeline } from '@/components/live/MatchTimeline'
import { SubstitutionModal } from '@/components/live/SubstitutionModal'
import { FinishedBanner } from '@/components/live/FinishedBanner'
import { useLiveSocket } from '@/hooks/useLiveSocket'
import { useMakeSubstitution, SubstitutionError } from '@/hooks/useMakeSubstitution'
import { useInterpolatedMinute } from '@/hooks/useInterpolatedMinute'
import { WsErrorCode } from '@/lib/contracts/ws'
import { resolveMatchPalettes } from '@/lib/teamColors'

interface Props {
  room: RoomSnapshotDto
  isHost: boolean
  finished?: boolean
}

const TOAST_BY_CODE: Partial<Record<string, string>> = {
  [WsErrorCode.MATCH_NOT_STARTED]: 'Aguardando início da partida.',
  [WsErrorCode.ATHLETE_NOT_IN_TEAM]: 'Atleta não está mais no seu time.',
  [WsErrorCode.ATHLETE_NOT_AVAILABLE]: 'Atleta não está mais disponível.',
  [WsErrorCode.POSITION_MISMATCH]: 'Posições não batem.',
  [WsErrorCode.NOT_LIVE]: 'Sala não está mais ao vivo.',
  [WsErrorCode.NOT_MEMBER]: 'Você não é membro desta sala.',
  [WsErrorCode.ROOM_NOT_FOUND]: 'Sala não encontrada.',
  UNKNOWN: 'Conexão instável — tente novamente.',
}

export function LiveMatchView({ room, isHost, finished = false }: Props) {
  useLiveSocket(room.id)

  const live = room.live
  const myRole = isHost ? 'host' : 'guest'
  const opponentNickname = isHost
    ? room.guest?.nickname ?? null
    : room.host.nickname
  const hadGuest = room.guest !== null

  const [subMode, setSubMode] = useState(false)

  const makeSub = useMakeSubstitution(room.id)
  const interpolatedMinute = useInterpolatedMinute(
    live?.currentMinute ?? null,
    live?.currentMinuteAt ?? null,
  )

  // Rooms that abandon during WAITING/DRAFTING never get a `live` snapshot —
  // PendingView used to catch this, but the dispatcher now sends every
  // FINISHED room here. Render the banner straight from `room.winner` (no
  // scoreboard/timeline to show — no events were ever generated).
  if (finished && !live) {
    return (
      <div className="space-y-3">
        <FinishedBanner
          winner={room.winner ?? 'abandoned'}
          myRole={myRole}
          opponentNickname={opponentNickname}
          hadGuest={hadGuest}
        />
      </div>
    )
  }

  if (!live) {
    // LIVE status with no live payload — race between the room snapshot and
    // the API's live state hydration. Brief flash before the refetch arrives.
    return (
      <div className="rounded-lg bg-surface p-6 text-center text-sm text-muted-foreground">
        Carregando estado da partida…
      </div>
    )
  }

  const myLineup = myRole === 'host' ? live.hostLineup : live.guestLineup
  const oppLineup = myRole === 'host' ? live.guestLineup : live.hostLineup
  const myScore = myRole === 'host' ? live.hostScore : live.guestScore
  const oppScore = myRole === 'host' ? live.guestScore : live.hostScore
  const myName = isHost ? room.host.nickname : room.guest?.nickname ?? 'Você'
  const oppName = opponentNickname ?? 'Oponente'

  const handleToggleSub = () => {
    setSubMode((prev) => !prev)
  }

  const palettes = resolveMatchPalettes(room.match.homeTeam, room.match.awayTeam)
  const homeTeamId = room.match.homeTeam.id

  return (
    <div className="space-y-3">
      <MatchHeader
        homeTeam={room.match.homeTeam}
        awayTeam={room.match.awayTeam}
        homeScore={live.homeScore}
        awayScore={live.awayScore}
        matchStatus={live.matchStatus}
        minute={interpolatedMinute}
      />
      <ScoreboardCards
        myName={myName}
        oppName={oppName}
        myScore={myScore}
        oppScore={oppScore}
        enableSubstitution={!finished}
        subMode={subMode}
        onToggleSub={handleToggleSub}
      />

      {finished && live.winner && (
        <FinishedBanner winner={live.winner} myRole={myRole} opponentNickname={opponentNickname} hadGuest={hadGuest} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TeamLineup title={myName} lineup={myLineup} palettes={palettes} homeTeamId={homeTeamId} />
        <TeamLineup title={oppName} lineup={oppLineup} palettes={palettes} homeTeamId={homeTeamId} />
      </div>

      <MatchTimeline events={live.recentEvents} />

      {subMode && !finished && (
        <SubstitutionModal
          open={subMode}
          lineup={myLineup}
          pool={live.pool}
          palettes={palettes}
          homeTeamId={homeTeamId}
          loading={makeSub.isPending}
          onClose={handleToggleSub}
          onConfirm={async (removeAthleteId, addAthleteId) => {
            try {
              await makeSub.mutateAsync({ removeAthleteId, addAthleteId })
              setSubMode(false)
            } catch (err: unknown) {
              const code = err instanceof SubstitutionError ? err.code : 'UNKNOWN'
              toast.error(TOAST_BY_CODE[code] ?? TOAST_BY_CODE.UNKNOWN!)
            }
          }}
        />
      )}
    </div>
  )
}
