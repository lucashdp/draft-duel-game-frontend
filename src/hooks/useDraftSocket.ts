'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketOn } from '@/lib/socket'
import {
  WsServerEvent,
  type DraftPickMadePayload,
  type DraftCurrentPickPayload,
  type MatchStartedPayload,
} from '@/lib/contracts/ws'
import { RoomStatus, type RoomSnapshotDto } from '@/lib/contracts/rooms'

/**
 * Listens for draft + match-start broadcasts and patches the room snapshot
 * cache. Assumes the parent has already opened the WS via useRoomSocket(roomId).
 */
export function useDraftSocket(roomId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!roomId) return

    const handlePickMade = (payload: DraftPickMadePayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.draft) return prev
        const picks = [...prev.draft.picks, payload.pick]
        const pool = prev.draft.pool.map((entry) =>
          entry.athlete.id === payload.pick.athlete.id
            ? { ...entry, pickedByRole: payload.pick.role }
            : entry,
        )
        const currentPickNumber = payload.nextPickNumber ?? 10
        return {
          ...prev,
          draft: {
            ...prev.draft,
            picks,
            pool,
            currentPickNumber,
            currentRole: payload.currentRole,
          },
        }
      })
    }

    const handleCurrentPick = (payload: DraftCurrentPickPayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.draft) return prev
        return {
          ...prev,
          draft: {
            ...prev.draft,
            currentPickNumber: payload.pickNumber,
            currentRole: payload.role,
          },
        }
      })
    }

    const handleMatchStarted = (_payload: MatchStartedPayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return { ...prev, status: RoomStatus.LIVE }
      })
    }

    const offPick = socketOn<DraftPickMadePayload>(WsServerEvent.DRAFT_PICK_MADE, handlePickMade)
    const offCurr = socketOn<DraftCurrentPickPayload>(WsServerEvent.DRAFT_CURRENT_PICK, handleCurrentPick)
    const offStart = socketOn<MatchStartedPayload>(WsServerEvent.MATCH_STARTED, handleMatchStarted)

    return () => {
      offPick()
      offCurr()
      offStart()
    }
  }, [queryClient, roomId])
}
