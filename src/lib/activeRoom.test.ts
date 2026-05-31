import { describe, expect, it } from 'vitest'
import { findActiveRoomForMatch } from './activeRoom'
import type { RoomSummaryDto } from '@/lib/contracts/rooms'

const room = (id: string, matchId: string): RoomSummaryDto => ({
  id,
  status: 'live',
  role: 'host',
  match: {
    id: matchId,
    kickoffAt: '2026-05-31T20:00:00.000Z',
    status: 'live',
    homeTeam: { name: 'A', shortName: 'A', abbreviation: 'A' },
    awayTeam: { name: 'B', shortName: 'B', abbreviation: 'B' },
  },
  opponent: null,
  winner: null,
  createdAt: '2026-05-31T19:00:00.000Z',
})

describe('findActiveRoomForMatch', () => {
  it('retorna a sala ativa da partida pedida', () => {
    const rooms = [room('r1', 'm-1'), room('r2', 'm-2')]
    expect(findActiveRoomForMatch(rooms, 'm-2')?.id).toBe('r2')
  })
  it('retorna null quando não há sala da partida', () => {
    expect(findActiveRoomForMatch([room('r1', 'm-1')], 'm-9')).toBeNull()
  })
  it('aceita undefined (dados ainda carregando)', () => {
    expect(findActiveRoomForMatch(undefined, 'm-1')).toBeNull()
  })
})
