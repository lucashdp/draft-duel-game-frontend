'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'
import type { AthleteRefDto } from '@/lib/contracts/draft'
import { MatchHeader } from '@/components/live/MatchHeader'
import { ScoreboardCards } from '@/components/live/ScoreboardCards'
import { TeamLineup } from '@/components/live/TeamLineup'
import { MatchTimeline } from '@/components/live/MatchTimeline'
import { SubstitutionPanel } from '@/components/live/SubstitutionPanel'
import { ConfirmSubDialog } from '@/components/live/ConfirmSubDialog'
import { FinishedBanner } from '@/components/live/FinishedBanner'
import { useLiveSocket } from '@/hooks/useLiveSocket'
import { useMakeSubstitution, SubstitutionError } from '@/hooks/useMakeSubstitution'
import { useInterpolatedMinute } from '@/hooks/useInterpolatedMinute'
import { WsErrorCode } from '@/lib/contracts/ws'

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

  const [subMode, setSubMode] = useState(false)
  const [selectedToRemove, setSelectedToRemove] = useState<AthleteRefDto | null>(null)
  const [pendingAddAthleteId, setPendingAddAthleteId] = useState<string | null>(null)

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
    setSelectedToRemove(null)
    setPendingAddAthleteId(null)
  }

  const handlePickFromPool = (addAthleteId: string) => {
    setPendingAddAthleteId(addAthleteId)
  }

  const cancelConfirm = () => setPendingAddAthleteId(null)

  const confirmSub = async () => {
    if (!selectedToRemove || !pendingAddAthleteId) return
    try {
      await makeSub.mutateAsync({
        removeAthleteId: selectedToRemove.id,
        addAthleteId: pendingAddAthleteId,
      })
      setSubMode(false)
      setSelectedToRemove(null)
      setPendingAddAthleteId(null)
    } catch (err: unknown) {
      const code = err instanceof SubstitutionError ? err.code : 'UNKNOWN'
      toast.error(TOAST_BY_CODE[code] ?? TOAST_BY_CODE.UNKNOWN!)
      setPendingAddAthleteId(null)
    }
  }

  const addedAthleteForDialog = pendingAddAthleteId
    ? live.pool.find((p) => p.athlete.id === pendingAddAthleteId)?.athlete ?? null
    : null

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
        <FinishedBanner
          winner={live.winner}
          myRole={myRole}
          opponentNickname={opponentNickname}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.5fr] gap-3">
        <TeamLineup
          title={myName}
          lineup={myLineup}
          subMode={subMode && !finished}
          selectedId={selectedToRemove?.id ?? null}
          onSelectRemove={(a) => setSelectedToRemove(a)}
        />
        <TeamLineup title={oppName} lineup={oppLineup} />
        <div className="space-y-3">
          <MatchTimeline events={live.recentEvents} />
          {subMode && selectedToRemove && (
            <SubstitutionPanel
              selectedToRemove={selectedToRemove}
              pool={live.pool}
              onPick={handlePickFromPool}
            />
          )}
        </div>
      </div>

      {pendingAddAthleteId && addedAthleteForDialog && selectedToRemove && (
        <ConfirmSubDialog
          open={!!pendingAddAthleteId}
          removedAthlete={selectedToRemove}
          addedAthlete={addedAthleteForDialog}
          onConfirm={confirmSub}
          onCancel={cancelConfirm}
          loading={makeSub.isPending}
        />
      )}
    </div>
  )
}
