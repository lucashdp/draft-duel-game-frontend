'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketOn } from '@/lib/socket'
import { WsServerEvent } from '@/lib/contracts/ws'
import {
  TOTAL_PICKS,
  draftPickMadePayloadSchema,
  draftCurrentPickPayloadSchema,
  matchStartedPayloadSchema,
} from '@/lib/contracts/draft'
import { RoomStatus, type RoomSnapshotDto } from '@/lib/contracts/rooms'

/**
 * Listens for draft + match-start broadcasts and patches the room snapshot
 * cache. Assumes the parent has already opened the WS via useRoomSocket(roomId).
 *
 * Payloads are validated at runtime with Zod (same pattern as useRoomSocket's
 * room:state handler). Malformed payloads are dropped + logged so the cache
 * never gets corrupted by a regression or version skew on the server.
 */
export function useDraftSocket(roomId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!roomId) return

    const handlePickMade = (raw: unknown) => {
      const parsed = draftPickMadePayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useDraftSocket] invalid draft:pick_made payload', parsed.error)
        return
      }
      const payload = parsed.data
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.draft) return prev
        const picks = [...prev.draft.picks, payload.pick]
        const pool = prev.draft.pool.map((entry) =>
          entry.athlete.id === payload.pick.athlete.id
            ? { ...entry, pickedByRole: payload.pick.role }
            : entry,
        )
        const currentPickNumber = payload.nextPickNumber ?? TOTAL_PICKS
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

    const handleCurrentPick = (raw: unknown) => {
      const parsed = draftCurrentPickPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useDraftSocket] invalid draft:current_pick payload', parsed.error)
        return
      }
      const payload = parsed.data
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

    const handleMatchStarted = (raw: unknown) => {
      const parsed = matchStartedPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useDraftSocket] invalid match:started payload', parsed.error)
        return
      }
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return { ...prev, status: RoomStatus.LIVE }
      })
    }

    const offPick = socketOn<unknown>(WsServerEvent.DRAFT_PICK_MADE, handlePickMade)
    const offCurr = socketOn<unknown>(WsServerEvent.DRAFT_CURRENT_PICK, handleCurrentPick)
    const offStart = socketOn<unknown>(WsServerEvent.MATCH_STARTED, handleMatchStarted)

    return () => {
      offPick()
      offCurr()
      offStart()
    }
  }, [queryClient, roomId])
}
