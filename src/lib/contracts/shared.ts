import { z } from 'zod'

/** Wire format = lowercase (mirrors API's mapper output, matches src/types/domain.ts). */
const ROLE_VALUES = ['host', 'guest'] as const
export const Role = {
  HOST: ROLE_VALUES[0],
  GUEST: ROLE_VALUES[1],
} as const
export type Role = (typeof ROLE_VALUES)[number]
export const roleSchema = z.enum(ROLE_VALUES)

const ROOM_STATUS_VALUES = ['waiting', 'drafting', 'live', 'finished'] as const
export const RoomStatus = {
  WAITING: ROOM_STATUS_VALUES[0],
  DRAFTING: ROOM_STATUS_VALUES[1],
  LIVE: ROOM_STATUS_VALUES[2],
  FINISHED: ROOM_STATUS_VALUES[3],
} as const
export type RoomStatus = (typeof ROOM_STATUS_VALUES)[number]
export const roomStatusSchema = z.enum(ROOM_STATUS_VALUES)

const ROOM_WINNER_VALUES = ['host', 'guest', 'draw', 'abandoned'] as const
export const RoomWinner = {
  HOST: ROOM_WINNER_VALUES[0],
  GUEST: ROOM_WINNER_VALUES[1],
  DRAW: ROOM_WINNER_VALUES[2],
  ABANDONED: ROOM_WINNER_VALUES[3],
} as const
export type RoomWinner = (typeof ROOM_WINNER_VALUES)[number]
export const roomWinnerSchema = z.enum(ROOM_WINNER_VALUES)

// Wire format for the underlying real match (Cartola/etc). `canceled` mirrors
// the API's MatchStatus enum (added in vertical 5 for partidas que o provider
// marca como definitivamente canceladas — distinto de POSTPONED, que pode ser
// remarcada). Both map to room winner='abandoned'.
const MATCH_STATUS_VALUES = ['scheduled', 'live', 'finished', 'postponed', 'canceled'] as const
export const MatchStatus = {
  SCHEDULED: MATCH_STATUS_VALUES[0],
  LIVE: MATCH_STATUS_VALUES[1],
  FINISHED: MATCH_STATUS_VALUES[2],
  POSTPONED: MATCH_STATUS_VALUES[3],
  CANCELED: MATCH_STATUS_VALUES[4],
} as const
export type MatchStatus = (typeof MATCH_STATUS_VALUES)[number]
export const matchStatusSchema = z.enum(MATCH_STATUS_VALUES)
