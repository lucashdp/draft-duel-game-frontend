'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketOn } from '@/lib/socket'
import { WsServerEvent } from '@/lib/contracts/ws'
import {
  matchEventPayloadSchema,
  matchEventCanceledPayloadSchema,
  matchTickPayloadSchema,
  matchSubstitutionAppliedPayloadSchema,
  matchFinishedPayloadSchema,
  lineupConfirmedPayloadSchema,
} from '@/lib/contracts/live'
import { RoomStatus, type RoomSnapshotDto } from '@/lib/contracts/rooms'

/**
 * Cap on the in-memory recent-events feed. Matches the live spec's UI (one
 * timeline column showing the last few events) — server snapshot already
 * paginates older events out, so 50 is plenty of headroom for the burst of
 * actions inside a single render cycle.
 */
const RECENT_EVENTS_CAP = 50

/**
 * Listens for live-match broadcasts and patches the room snapshot cache.
 * Assumes the parent has already opened the WS via useRoomSocket(roomId).
 *
 * Mirrors useDraftSocket: payloads are Zod-validated, malformed ones are
 * dropped + logged + the snapshot is invalidated so the next REST refetch
 * pulls the authoritative state. For `substitution_applied` + `lineup:confirmed`
 * we invalidate instead of patching by hand — lineup + pool diffs are noisier
 * than a fresh snapshot is expensive.
 */
export function useLiveSocket(roomId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!roomId) return

    const handleEvent = (raw: unknown) => {
      const parsed = matchEventPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useLiveSocket] invalid match:event payload', parsed.error)
        queryClient.invalidateQueries({ queryKey: ['room', roomId] })
        return
      }
      const payload = parsed.data
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.live) return prev
        const recentEvents = [payload.event, ...prev.live.recentEvents].slice(
          0,
          RECENT_EVENTS_CAP,
        )
        return {
          ...prev,
          live: {
            ...prev.live,
            recentEvents,
            hostScore: payload.hostScore,
            guestScore: payload.guestScore,
          },
        }
      })
    }

    const handleEventCanceled = (raw: unknown) => {
      const parsed = matchEventCanceledPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useLiveSocket] invalid match:event_canceled payload', parsed.error)
        queryClient.invalidateQueries({ queryKey: ['room', roomId] })
        return
      }
      const payload = parsed.data
      // Patch scores optimistically, then invalidate so the recentEvents +
      // lineup cumulativePoints get fully reconciled from the snapshot.
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.live) return prev
        return {
          ...prev,
          live: {
            ...prev.live,
            hostScore: payload.hostScore,
            guestScore: payload.guestScore,
          },
        }
      })
      queryClient.invalidateQueries({ queryKey: ['room', roomId] })
    }

    const handleTick = (raw: unknown) => {
      const parsed = matchTickPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useLiveSocket] invalid match:tick payload', parsed.error)
        queryClient.invalidateQueries({ queryKey: ['room', roomId] })
        return
      }
      const payload = parsed.data
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.live) return prev
        return {
          ...prev,
          live: {
            ...prev.live,
            currentMinute: payload.currentMinute,
            currentMinuteAt: payload.currentMinuteAt,
            homeScore: payload.homeScore,
            awayScore: payload.awayScore,
          },
        }
      })
    }

    const handleSubstitutionApplied = (raw: unknown) => {
      const parsed = matchSubstitutionAppliedPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error(
          '[useLiveSocket] invalid match:substitution_applied payload',
          parsed.error,
        )
        queryClient.invalidateQueries({ queryKey: ['room', roomId] })
        return
      }
      // Subs mutate lineup + pool + scores together; a snapshot refetch is
      // simpler (and less bug-prone) than reconciling those by hand.
      queryClient.invalidateQueries({ queryKey: ['room', roomId] })
    }

    const handleFinished = (raw: unknown) => {
      const parsed = matchFinishedPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useLiveSocket] invalid match:finished payload', parsed.error)
        queryClient.invalidateQueries({ queryKey: ['room', roomId] })
        return
      }
      const payload = parsed.data
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          status: RoomStatus.FINISHED,
          winner: payload.winner,
          // Keep `match.status` in lockstep with the room/live state — otherwise
          // any future consumer reading `room.match.status` would see a stale
          // `'live'` value until the next snapshot refetch.
          match: { ...prev.match, status: 'finished' as const },
          live: prev.live
            ? {
                ...prev.live,
                matchStatus: 'finished',
                winner: payload.winner,
                hostScore: payload.hostScore,
                guestScore: payload.guestScore,
              }
            : prev.live,
        }
      })
    }

    const handleLineupConfirmed = (raw: unknown) => {
      const parsed = lineupConfirmedPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        console.error('[useLiveSocket] invalid lineup:confirmed payload', parsed.error)
        queryClient.invalidateQueries({ queryKey: ['room', roomId] })
        return
      }
      queryClient.invalidateQueries({ queryKey: ['room', roomId] })
    }

    const offEvent = socketOn<unknown>(WsServerEvent.MATCH_EVENT, handleEvent)
    const offCanceled = socketOn<unknown>(
      WsServerEvent.MATCH_EVENT_CANCELED,
      handleEventCanceled,
    )
    const offTick = socketOn<unknown>(WsServerEvent.MATCH_TICK, handleTick)
    const offSub = socketOn<unknown>(
      WsServerEvent.MATCH_SUBSTITUTION_APPLIED,
      handleSubstitutionApplied,
    )
    const offFinished = socketOn<unknown>(WsServerEvent.MATCH_FINISHED, handleFinished)
    const offLineup = socketOn<unknown>(
      WsServerEvent.LINEUP_CONFIRMED,
      handleLineupConfirmed,
    )

    return () => {
      offEvent()
      offCanceled()
      offTick()
      offSub()
      offFinished()
      offLineup()
    }
  }, [queryClient, roomId])
}
