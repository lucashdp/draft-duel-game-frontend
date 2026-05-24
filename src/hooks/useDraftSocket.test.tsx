import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDraftSocket } from './useDraftSocket'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'
import type { DraftPickMadePayload, MatchStartedPayload } from '@/lib/contracts/draft'

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
  name: 'A', shortName: 'A', position: 'GOL' as const,
  jerseyNumber: 1, teamId: '00000000-0000-4000-8000-000000000020',
}

function makeSnapshot(): RoomSnapshotDto {
  return {
    id: ROOM_ID,
    code: 'ABCDEF',
    status: 'drafting',
    match: {
      id: '00000000-0000-4000-8000-000000000030',
      kickoffAt: '2026-06-11T19:00:00.000Z',
      status: 'scheduled',
      homeTeam: { id: 'h', name: 'H', shortName: 'H', abbreviation: 'H', primaryColor: '#fff', secondaryColor: '#000' },
      awayTeam: { id: 'a', name: 'A', shortName: 'A', abbreviation: 'A', primaryColor: '#fff', secondaryColor: '#000' },
    },
    host: { id: '00000000-0000-4000-8000-0000000000a0', nickname: 'host' },
    guest: { id: '00000000-0000-4000-8000-0000000000b0', nickname: 'guest' },
    winner: null,
    expiresAt: '2026-06-11T22:00:00.000Z',
    createdAt: '2026-06-11T18:30:00.000Z',
    draft: {
      currentPickNumber: 0,
      currentRole: 'host',
      lineupReady: true,
      picks: [],
      pool: [
        { athlete: ATH, teamSide: 'home', pickedByRole: null },
      ],
    },
    live: null,
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

describe('useDraftSocket', () => {
  beforeEach(() => listeners.clear())

  it('appends pick + bumps currentPickNumber on draft:pick_made', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    renderHook(() => useDraftSocket(ROOM_ID), { wrapper: Wrapper })
    const payload: DraftPickMadePayload = {
      pick: { pickNumber: 0, role: 'host', athlete: ATH, madeAt: '2026-06-11T19:01:00.000Z' },
      nextPickNumber: 1,
      currentRole: 'guest',
    }
    act(() => listeners.get('draft:pick_made')!(payload))
    const updated = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])!
    expect(updated.draft?.picks).toHaveLength(1)
    expect(updated.draft?.currentPickNumber).toBe(1)
    expect(updated.draft?.currentRole).toBe('guest')
    expect(updated.draft?.pool[0].pickedByRole).toBe('host')
  })

  it('flips room.status to live on match:started', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    renderHook(() => useDraftSocket(ROOM_ID), { wrapper: Wrapper })
    const payload: MatchStartedPayload = {
      startedAt: '2026-06-11T19:30:00.000Z',
      hostLineup: [ATH], guestLineup: [ATH],
    }
    act(() => listeners.get('match:started')!(payload))
    const updated = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])!
    expect(updated.status).toBe('live')
  })

  it('cleans up listeners on unmount', () => {
    const { Wrapper } = wrapper(makeSnapshot())
    const { unmount } = renderHook(() => useDraftSocket(ROOM_ID), { wrapper: Wrapper })
    expect(listeners.size).toBeGreaterThan(0)
    unmount()
    expect(listeners.size).toBe(0)
  })

  it('drops the update and invalidates the room query when payload is malformed', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { qc, Wrapper } = wrapper(makeSnapshot())
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useDraftSocket(ROOM_ID), { wrapper: Wrapper })
    const before = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])

    act(() => listeners.get('draft:pick_made')!({ garbage: true }))

    expect(qc.getQueryData(['room', ROOM_ID])).toBe(before)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['room', ROOM_ID] })
    expect(errSpy).toHaveBeenCalled()

    errSpy.mockRestore()
    invalidateSpy.mockRestore()
  })
})
