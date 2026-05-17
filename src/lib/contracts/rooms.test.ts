import { describe, expect, it } from 'vitest'
import {
  RoomStatus,
  Role,
  RoomWinner,
  RoomErrorCode,
  roomSnapshotSchema,
  roomPreviewSchema,
  myRoomsResponseSchema,
} from './rooms'

const validSnapshot = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: {
      id: 'th',
      name: 'Flamengo',
      shortName: 'Flamengo',
      abbreviation: 'FLA',
      primaryColor: '#FF0000',
      secondaryColor: '#000000',
    },
    awayTeam: {
      id: 'ta',
      name: 'Palmeiras',
      shortName: 'Palmeiras',
      abbreviation: 'PAL',
      primaryColor: '#006633',
      secondaryColor: '#FFFFFF',
    },
  },
  host: { id: 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', nickname: 'alice' },
  guest: null,
  winner: null,
  expiresAt: '2026-05-18T20:00:00.000Z',
  createdAt: '2026-05-17T10:00:00.000Z',
}

describe('rooms contracts', () => {
  it('exposes RoomStatus as const + type (lowercase wire values)', () => {
    expect(RoomStatus.WAITING).toBe('waiting')
    expect(RoomStatus.DRAFTING).toBe('drafting')
    expect(RoomStatus.LIVE).toBe('live')
    expect(RoomStatus.FINISHED).toBe('finished')
  })

  it('exposes Role and RoomWinner (lowercase wire values)', () => {
    expect(Role.HOST).toBe('host')
    expect(Role.GUEST).toBe('guest')
    expect(RoomWinner.HOST).toBe('host')
    expect(RoomWinner.DRAW).toBe('draw')
    expect(RoomWinner.ABANDONED).toBe('abandoned')
  })

  it('exposes RoomErrorCode matching API enum (UPPERCASE — these are error codes, not domain enums)', () => {
    expect(RoomErrorCode.MATCH_NOT_FOUND).toBe('MATCH_NOT_FOUND')
    expect(RoomErrorCode.MATCH_INELIGIBLE).toBe('MATCH_INELIGIBLE')
    expect(RoomErrorCode.ROOM_NOT_FOUND).toBe('ROOM_NOT_FOUND')
    expect(RoomErrorCode.ROOM_NOT_OPEN).toBe('ROOM_NOT_OPEN')
    expect(RoomErrorCode.ROOM_EXPIRED).toBe('ROOM_EXPIRED')
    expect(RoomErrorCode.IS_HOST).toBe('IS_HOST')
    expect(RoomErrorCode.RACE_LOST).toBe('RACE_LOST')
    expect(RoomErrorCode.NOT_MEMBER).toBe('NOT_MEMBER')
  })

  it('roomSnapshotSchema parses a valid waiting room', () => {
    const parsed = roomSnapshotSchema.parse(validSnapshot)
    expect(parsed.status).toBe('waiting')
    expect(parsed.guest).toBeNull()
  })

  it('roomSnapshotSchema rejects UPPERCASE status (must be wire-format)', () => {
    expect(() =>
      roomSnapshotSchema.parse({ ...validSnapshot, status: 'WAITING' }),
    ).toThrow()
  })

  it('roomPreviewSchema strips id/host.id', () => {
    const parsed = roomPreviewSchema.parse({
      code: 'K7M2QH',
      status: 'waiting',
      match: {
        kickoffAt: validSnapshot.match.kickoffAt,
        status: validSnapshot.match.status,
        homeTeam: {
          name: 'F',
          shortName: 'F',
          abbreviation: 'FLA',
          primaryColor: '#FF0000',
          secondaryColor: '#000000',
        },
        awayTeam: {
          name: 'P',
          shortName: 'P',
          abbreviation: 'PAL',
          primaryColor: '#006633',
          secondaryColor: '#FFFFFF',
        },
      },
      host: { nickname: 'alice' },
      expiresAt: validSnapshot.expiresAt,
    })
    expect(parsed.host).toEqual({ nickname: 'alice' })
  })

  it('myRoomsResponseSchema parses { active, finished }', () => {
    const parsed = myRoomsResponseSchema.parse({ active: [], finished: [] })
    expect(parsed.active).toEqual([])
    expect(parsed.finished).toEqual([])
  })
})
