import { z } from 'zod'
import { draftStateSchema } from '@/lib/contracts/draft'
import { liveStateSchema } from './live'
import {
  Role,
  roleSchema,
  RoomStatus,
  roomStatusSchema,
  RoomWinner,
  roomWinnerSchema,
  MatchStatus,
  matchStatusSchema,
} from '@/lib/contracts/shared'

export {
  Role,
  roleSchema,
  RoomStatus,
  roomStatusSchema,
  RoomWinner,
  roomWinnerSchema,
  MatchStatus,
  matchStatusSchema,
}

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
  status: roomStatusSchema,
  match: z.object({
    id: z.string().uuid(),
    kickoffAt: z.string(),
    status: matchStatusSchema,
    homeTeam: teamRefSchema,
    awayTeam: teamRefSchema,
  }),
  host: userRefSchema,
  guest: userRefSchema.nullable(),
  winner: roomWinnerSchema.nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
  draft: draftStateSchema.nullable(),
  live: liveStateSchema.nullable(),
})
export type RoomSnapshotDto = z.infer<typeof roomSnapshotSchema>

export const roomPreviewSchema = z.object({
  code: z.string().length(6),
  status: roomStatusSchema,
  match: z.object({
    kickoffAt: z.string(),
    status: matchStatusSchema,
    homeTeam: teamRefPublicSchema,
    awayTeam: teamRefPublicSchema,
  }),
  host: z.object({ nickname: z.string() }),
  expiresAt: z.string(),
})
export type RoomPreviewDto = z.infer<typeof roomPreviewSchema>

export const roomSummarySchema = z.object({
  id: z.string().uuid(),
  status: roomStatusSchema,
  role: roleSchema,
  match: z.object({
    kickoffAt: z.string(),
    status: matchStatusSchema,
    homeTeam: teamRefSummarySchema,
    awayTeam: teamRefSummarySchema,
  }),
  opponent: z.object({ nickname: z.string() }).nullable(),
  winner: roomWinnerSchema.nullable(),
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
