import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { RoomErrorCode } from '@/lib/contracts/rooms'
import { formatJoinError } from './format-room'

describe('formatJoinError', () => {
  it('returns the unauthorized message on 401, regardless of code', () => {
    expect(formatJoinError(new ApiError(401, 'nope'))).toMatch(/sessão expirou/i)
  })

  it.each([
    [RoomErrorCode.IS_HOST, /anfitrião/i],
    [RoomErrorCode.ROOM_NOT_OPEN, /em andamento/i],
    [RoomErrorCode.ROOM_EXPIRED, /expirou/i],
    [RoomErrorCode.ROOM_NOT_FOUND, /não encontrada/i],
    [RoomErrorCode.MATCH_INELIGIBLE, /não está mais disponível/i],
    [RoomErrorCode.RACE_LOST, /entrou primeiro/i],
  ])('maps RoomErrorCode %s to a human message', (code, pattern) => {
    expect(formatJoinError(new ApiError(409, 'x', code))).toMatch(pattern)
  })

  it('falls back to a generic message for unknown ApiError codes', () => {
    expect(formatJoinError(new ApiError(500, 'boom'))).toMatch(/não foi possível entrar/i)
  })

  it('falls back to a generic message for non-ApiError values', () => {
    expect(formatJoinError(new Error('network'))).toMatch(/não foi possível entrar/i)
    expect(formatJoinError(null)).toMatch(/não foi possível entrar/i)
  })
})
