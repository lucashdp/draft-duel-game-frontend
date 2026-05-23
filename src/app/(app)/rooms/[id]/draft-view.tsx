'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { DraftPool } from '@/components/draft/DraftPool'
import { TurnBanner } from '@/components/draft/TurnBanner'
import { ConfirmPickDialog } from '@/components/draft/ConfirmPickDialog'
import { RoomActions } from '@/components/rooms/RoomActions'
import { useDraftSocket } from '@/hooks/useDraftSocket'
import { useMakePick, PickError } from '@/hooks/useMakePick'
import { computePositionsRemaining } from '@/lib/draft-positions-remaining'
import { WsErrorCode } from '@/lib/contracts/ws'
import type { AthleteRefDto } from '@/lib/contracts/draft'
import type { RoomSnapshotDto, Role } from '@/lib/contracts/rooms'

const TOAST_BY_CODE: Partial<Record<string, string>> = {
  [WsErrorCode.LINEUP_NOT_READY]: 'Escalação ainda não confirmada.',
  [WsErrorCode.NOT_YOUR_TURN]: 'Não é sua vez agora.',
  [WsErrorCode.POSITION_ALREADY_FILLED]: 'Você já tem um atleta dessa posição.',
  [WsErrorCode.ATHLETE_ALREADY_PICKED]: 'Esse atleta já foi draftado.',
  [WsErrorCode.ATHLETE_NOT_IN_LINEUP]: 'Atleta não está mais escalado.',
  [WsErrorCode.INVALID_PICK_NUMBER]: 'Pick desincronizado — atualizando…',
  [WsErrorCode.PICK_RACE_LOST]: 'Outro jogador foi mais rápido.',
  [WsErrorCode.NOT_DRAFTING]: 'O draft não está mais em andamento.',
  // UNKNOWN covers ack timeout + malformed ack from useMakePick — both
  // suggest a transient connection issue, so orient the user toward retry.
  UNKNOWN: 'Conexão instável — tente novamente.',
}

interface Props {
  room: RoomSnapshotDto
  isHost: boolean
}

export function DraftView({ room, isHost }: Props) {
  useDraftSocket(room.id)
  const queryClient = useQueryClient()
  const makePick = useMakePick(room.id)
  const [selected, setSelected] = useState<AthleteRefDto | null>(null)

  const draft = room.draft
  const myRole: Role = isHost ? 'host' : 'guest'

  const positionsRemaining = useMemo(
    () => computePositionsRemaining(draft?.picks ?? [], myRole),
    [draft?.picks, myRole],
  )

  const refreshSnapshot = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['room', room.id] })
  }, [queryClient, room.id])

  // If the selected athlete becomes unavailable mid-confirmation (opponent
  // picked them via WS race), close the dialog so the user isn't stuck looking
  // at a stale choice.
  useEffect(() => {
    if (!selected) return
    const entry = draft?.pool.find((p) => p.athlete.id === selected.id)
    if (entry?.pickedByRole) setSelected(null)
  }, [selected, draft?.pool])

  if (!draft) {
    return null
  }

  const hostNickname = room.host.nickname
  const guestNickname = room.guest?.nickname ?? 'oponente'
  const opponentNickname = isHost ? guestNickname : hostNickname
  const isMyTurn = draft.currentRole === myRole
  const canPick = isMyTurn && draft.lineupReady && !makePick.isPending

  const selectedTeamName = selected
    ? (selected.teamId === room.match.homeTeam.id
        ? room.match.homeTeam.name
        : room.match.awayTeam.name)
    : ''

  function handlePoolClick(athleteId: string) {
    const entry = draft!.pool.find((p) => p.athlete.id === athleteId)
    if (!entry) return
    setSelected(entry.athlete)
  }

  function handleConfirm() {
    if (!selected) return
    makePick.mutate(
      { pickNumber: draft!.currentPickNumber, athleteId: selected.id },
      {
        onSuccess: () => {
          setSelected(null)
        },
        onError: (err: PickError) => {
          setSelected(null)
          const msg = TOAST_BY_CODE[err.code] ?? 'Falha ao registrar pick.'
          toast.error(msg)
          if (
            err.code === WsErrorCode.INVALID_PICK_NUMBER ||
            err.code === WsErrorCode.PICK_RACE_LOST ||
            err.code === WsErrorCode.ATHLETE_ALREADY_PICKED ||
            err.code === WsErrorCode.NOT_DRAFTING
          ) {
            refreshSnapshot()
          }
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <TurnBanner
        lineupReady={draft.lineupReady}
        currentRole={draft.currentRole}
        myRole={myRole}
        currentPickNumber={draft.currentPickNumber}
        opponentNickname={opponentNickname}
      />
      <DraftBoard
        picks={draft.picks}
        currentPickNumber={draft.currentPickNumber}
        homeTeam={room.match.homeTeam}
        awayTeam={room.match.awayTeam}
        hostNickname={hostNickname}
        guestNickname={guestNickname}
      />
      <DraftPool
        pool={draft.pool}
        disabled={!canPick}
        lineupReady={draft.lineupReady}
        homeTeam={room.match.homeTeam}
        awayTeam={room.match.awayTeam}
        positionsRemaining={positionsRemaining}
        hostNickname={hostNickname}
        guestNickname={guestNickname}
        onPick={handlePoolClick}
        onRefresh={refreshSnapshot}
      />
      <ConfirmPickDialog
        athlete={selected}
        teamName={selectedTeamName}
        onConfirm={handleConfirm}
        onCancel={() => setSelected(null)}
        isPending={makePick.isPending}
      />
      <RoomActions roomId={room.id} showAbandon={true} />
    </div>
  )
}
