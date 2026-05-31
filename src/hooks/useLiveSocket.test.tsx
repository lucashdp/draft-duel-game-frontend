import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLiveSocket } from './useLiveSocket'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'
import type {
  MatchEventPayload,
  MatchFinishedPayload,
  MatchTickPayload,
} from '@/lib/contracts/live'

const listeners = new Map<string, (p: unknown) => void>()
vi.mock('@/lib/socket', () => ({
  socketOn: (event: string, handler: (p: unknown) => void) => {
    listeners.set(event, handler)
    return () => listeners.delete(event)
  },
}))

const ROOM_ID = '00000000-0000-4000-8000-000000000001'
const ATH = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Pedro',
  shortName: 'Pedro',
  position: 'ATA' as const,
  jerseyNumber: 9,
  teamId: '00000000-0000-4000-8000-000000000020',
}

function makeSnapshot(): RoomSnapshotDto {
  return {
    id: ROOM_ID,
    code: 'ABCDEF',
    status: 'live',
    match: {
      id: '00000000-0000-4000-8000-000000000030',
      kickoffAt: '2026-06-11T19:00:00.000Z',
      status: 'live',
      homeTeam: { id: 'h', name: 'H', shortName: 'H', abbreviation: 'H', imageUrl: null, primaryColor: '#fff', secondaryColor: '#000' },
      awayTeam: { id: 'a', name: 'A', shortName: 'A', abbreviation: 'A', imageUrl: null, primaryColor: '#fff', secondaryColor: '#000' },
    },
    host: { id: '00000000-0000-4000-8000-0000000000a0', nickname: 'host' },
    guest: { id: '00000000-0000-4000-8000-0000000000b0', nickname: 'guest' },
    winner: null,
    expiresAt: '2026-06-11T22:00:00.000Z',
    createdAt: '2026-06-11T18:30:00.000Z',
    draft: null,
    live: {
      matchStatus: 'live',
      currentMinute: 10,
      currentMinuteAt: '2026-06-11T19:10:00.000Z',
      homeScore: 0,
      awayScore: 0,
      hostScore: 0,
      guestScore: 0,
      winner: null,
      hostLineup: [],
      guestLineup: [],
      recentEvents: [],
      pool: [],
    },
  }
}

function wrapper(initial: RoomSnapshotDto) {
  const qc = new QueryClient()
  qc.setQueryData(['room', ROOM_ID], initial)
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  return { qc, Wrapper }
}

const EXPECTED_EVENTS = [
  'match:event',
  'match:event_canceled',
  'match:tick',
  'match:substitution_applied',
  'match:finished',
  'lineup:confirmed',
]

describe('useLiveSocket', () => {
  beforeEach(() => listeners.clear())

  it('subscribes to all 6 live events on mount and unsubscribes on unmount', () => {
    const { Wrapper } = wrapper(makeSnapshot())
    const { unmount } = renderHook(() => useLiveSocket(ROOM_ID), { wrapper: Wrapper })
    for (const evt of EXPECTED_EVENTS) {
      expect(listeners.has(evt)).toBe(true)
    }
    expect(listeners.size).toBe(EXPECTED_EVENTS.length)
    unmount()
    expect(listeners.size).toBe(0)
  })

  it('prepends event to recentEvents and updates scores on match:event', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    renderHook(() => useLiveSocket(ROOM_ID), { wrapper: Wrapper })
    const payload: MatchEventPayload = {
      event: {
        id: '00000000-0000-4000-8000-0000000000e1',
        athlete: ATH,
        action: 'GOAL',
        minute: 15,
        points: 8,
        affectedRole: 'host',
        canceled: false,
      },
      hostScore: 8,
      guestScore: 0,
    }
    act(() => listeners.get('match:event')!(payload))
    const updated = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])!
    expect(updated.live?.recentEvents).toHaveLength(1)
    expect(updated.live?.recentEvents[0].id).toBe(payload.event.id)
    expect(updated.live?.hostScore).toBe(8)
    expect(updated.live?.guestScore).toBe(0)
  })

  it('updates currentMinute + currentMinuteAt + scores on match:tick', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    renderHook(() => useLiveSocket(ROOM_ID), { wrapper: Wrapper })
    const payload: MatchTickPayload = {
      currentMinute: 20,
      currentMinuteAt: '2026-06-11T19:20:00.000Z',
      homeScore: 1,
      awayScore: 0,
    }
    act(() => listeners.get('match:tick')!(payload))
    const updated = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])!
    expect(updated.live?.currentMinute).toBe(20)
    expect(updated.live?.currentMinuteAt).toBe(payload.currentMinuteAt)
    expect(updated.live?.homeScore).toBe(1)
    expect(updated.live?.awayScore).toBe(0)
  })

  it('flips room.status to finished and patches winner on match:finished', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    renderHook(() => useLiveSocket(ROOM_ID), { wrapper: Wrapper })
    const payload: MatchFinishedPayload = {
      hostScore: 12,
      guestScore: 5,
      winner: 'host',
      finishedAt: '2026-06-11T21:00:00.000Z',
    }
    act(() => listeners.get('match:finished')!(payload))
    const updated = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])!
    expect(updated.status).toBe('finished')
    expect(updated.match.status).toBe('finished')
    expect(updated.winner).toBe('host')
    expect(updated.live?.matchStatus).toBe('finished')
    expect(updated.live?.winner).toBe('host')
    expect(updated.live?.hostScore).toBe(12)
    expect(updated.live?.guestScore).toBe(5)
  })

  it('invalidates the room query on match:substitution_applied', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useLiveSocket(ROOM_ID), { wrapper: Wrapper })
    act(() =>
      listeners.get('match:substitution_applied')!({
        role: 'host',
        removedAthlete: ATH,
        addedAthlete: { ...ATH, id: '00000000-0000-4000-8000-000000000011' },
        minute: 30,
        hostScore: 8,
        guestScore: 5,
      }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['room', ROOM_ID] })
    invalidateSpy.mockRestore()
  })

  it('invalidates the room query on lineup:confirmed', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useLiveSocket(ROOM_ID), { wrapper: Wrapper })
    act(() =>
      listeners.get('lineup:confirmed')!({
        matchId: '00000000-0000-4000-8000-000000000030',
      }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['room', ROOM_ID] })
    invalidateSpy.mockRestore()
  })

  it('drops the update and invalidates the room query when payload is malformed', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { qc, Wrapper } = wrapper(makeSnapshot())
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useLiveSocket(ROOM_ID), { wrapper: Wrapper })
    const before = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])

    act(() => listeners.get('match:event')!({ garbage: true }))

    expect(qc.getQueryData(['room', ROOM_ID])).toBe(before)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['room', ROOM_ID] })
    expect(errSpy).toHaveBeenCalled()

    errSpy.mockRestore()
    invalidateSpy.mockRestore()
  })
})
