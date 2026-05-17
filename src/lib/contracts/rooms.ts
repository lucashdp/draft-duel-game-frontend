import { z } from 'zod'

/** Wire format = lowercase (mirrors API's mapper output, matches src/types/domain.ts). */
export const RoomStatus = {
  WAITING: 'waiting',
  DRAFTING: 'drafting',
  LIVE: 'live',
  FINISHED: 'finished',
} as const
export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus]

export const Role = {
  HOST: 'host',
  GUEST: 'guest',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const RoomWinner = {
  HOST: 'host',
  GUEST: 'guest',
  DRAW: 'draw',
  ABANDONED: 'abandoned',
} as const
export type RoomWinner = (typeof RoomWinner)[keyof typeof RoomWinner]

export const MatchStatus = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
} as const
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus]

export const RoomErrorCode = {
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  MATCH_INELIGIBLE: 'MATCH_INELIGIBLE',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_NOT_OPEN: 'ROOM_NOT_OPEN',
  ROOM_EXPIRED: 'ROOM_EXPIRED',
  IS_HOST: 'IS_HOST',
  RACE_LOST: 'RACE_LOST',
  NOT_MEMBER: 'NOT_MEMBER',
} as const
export type RoomErrorCode = (typeof RoomErrorCode)[keyof typeof RoomErrorCode]

const teamRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
})
export type TeamRefDto = z.infer<typeof teamRefSchema>

const teamRefPublicSchema = teamRefSchema.omit({ id: true })
export type TeamRefPublicDto = z.infer<typeof teamRefPublicSchema>

const teamRefSummarySchema = z.object({
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
})
export type TeamRefSummaryDto = z.infer<typeof teamRefSummarySchema>

const userRefSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
})
export type UserRefDto = z.infer<typeof userRefSchema>

export const roomSnapshotSchema = z.object({
  id: z.string().uuid(),
  code: z.string().length(6),
  status: z.enum(Object.values(RoomStatus) as [string, ...string[]]),
  match: z.object({
    id: z.string().uuid(),
    kickoffAt: z.string(),
    status: z.enum(Object.values(MatchStatus) as [string, ...string[]]),
    homeTeam: teamRefSchema,
    awayTeam: teamRefSchema,
  }),
  host: userRefSchema,
  guest: userRefSchema.nullable(),
  winner: z.enum(Object.values(RoomWinner) as [string, ...string[]]).nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
})
export type RoomSnapshotDto = z.infer<typeof roomSnapshotSchema>

export const roomPreviewSchema = z.object({
  code: z.string().length(6),
  status: z.enum(Object.values(RoomStatus) as [string, ...string[]]),
  match: z.object({
    kickoffAt: z.string(),
    status: z.enum(Object.values(MatchStatus) as [string, ...string[]]),
    homeTeam: teamRefPublicSchema,
    awayTeam: teamRefPublicSchema,
  }),
  host: z.object({ nickname: z.string() }),
  expiresAt: z.string(),
})
export type RoomPreviewDto = z.infer<typeof roomPreviewSchema>

export const roomSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(Object.values(RoomStatus) as [string, ...string[]]),
  role: z.enum(Object.values(Role) as [string, ...string[]]),
  match: z.object({
    kickoffAt: z.string(),
    status: z.enum(Object.values(MatchStatus) as [string, ...string[]]),
    homeTeam: teamRefSummarySchema,
    awayTeam: teamRefSummarySchema,
  }),
  opponent: z.object({ nickname: z.string() }).nullable(),
  winner: z.enum(Object.values(RoomWinner) as [string, ...string[]]).nullable(),
  createdAt: z.string(),
})
export type RoomSummaryDto = z.infer<typeof roomSummarySchema>

export const myRoomsResponseSchema = z.object({
  active: z.array(roomSummarySchema),
  finished: z.array(roomSummarySchema),
})
export type MyRoomsResponseDto = z.infer<typeof myRoomsResponseSchema>

export const createRoomRequestSchema = z.object({
  matchId: z.string().uuid(),
})
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>
