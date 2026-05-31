import { describe, expect, it } from 'vitest'
import { findActiveRoomForMatch } from './activeRoom'
import type { RoomSummaryDto } from '@/lib/contracts/rooms'

const room = (
  id: string,
  matchId: string,
  role: 'host' | 'guest' = 'host',
  createdAt = '2026-05-31T19:00:00.000Z',
): RoomSummaryDto => ({
  id,
  status: 'live',
  role,
  match: {
    id: matchId,
    kickoffAt: '2026-05-31T20:00:00.000Z',
    status: 'live',
    homeTeam: { name: 'A', shortName: 'A', abbreviation: 'A' },
    awayTeam: { name: 'B', shortName: 'B', abbreviation: 'B' },
  },
  opponent: null,
  winner: null,
  createdAt,
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
  it('prefere a sala onde o usuário é host quando há duas da mesma partida', () => {
    const guestRoom = room('r-guest', 'm-1', 'guest', '2026-05-31T19:30:00.000Z')
    const hostRoom = room('r-host', 'm-1', 'host', '2026-05-31T19:00:00.000Z')
    expect(findActiveRoomForMatch([guestRoom, hostRoom], 'm-1')?.id).toBe('r-host')
  })
  it('cai na primeira da lista quando o usuário não é host de nenhuma', () => {
    const a = room('r-a', 'm-1', 'guest')
    const b = room('r-b', 'm-1', 'guest')
    expect(findActiveRoomForMatch([a, b], 'm-1')?.id).toBe('r-a')
  })
})
