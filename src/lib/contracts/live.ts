import { z } from 'zod'
import { athleteRefSchema } from './draft'
import {
  matchStatusSchema,
  type MatchStatus,
  roleSchema,
  roomWinnerSchema,
} from './shared'

export const ACTION_TYPES = [
  'GOAL', 'ASSIST', 'YELLOW_CARD', 'RED_CARD', 'SAVE', 'PENALTY_SAVE', 'OWN_GOAL',
  'PENALTY_MISS', 'PENALTY_GOAL', 'INTERCEPTION', 'TACKLE_WON', 'KEY_PASS', 'SHOT_ON_TARGET',
  'SHOT_OFF_TARGET', 'CLEAN_SHEET', 'HARD_SAVE', 'GOAL_CONCEDED', 'POST_HIT', 'MISSED_PASS',
  'FOUL_SUFFERED', 'FOUL_COMMITTED', 'OFFSIDE',
] as const
export const actionTypeSchema = z.enum(ACTION_TYPES)
export type ActionType = z.infer<typeof actionTypeSchema>

// Re-export shared schemas/types so consumers of the live contract have a
// single import surface. The enums themselves live in `shared.ts` to keep
// `rooms.ts` and `live.ts` (both consumers of the match-status / winner
// vocabulary) in lockstep — see PR #7 review for the bug this avoided.
export { matchStatusSchema, roleSchema, roomWinnerSchema }
export type { MatchStatus }

export const matchEventSchema = z.object({
  id: z.string().uuid(),
  athlete: athleteRefSchema,
  action: actionTypeSchema,
  minute: z.number().int(),
  points: z.number(),
  affectedRole: roleSchema.nullable(),
  canceled: z.boolean(),
})
export type MatchEvent = z.infer<typeof matchEventSchema>

export const lineupSlotSchema = z.object({
  athlete: athleteRefSchema,
  cumulativePoints: z.number(),
})
export type LineupSlot = z.infer<typeof lineupSlotSchema>

export const liveSubPoolEntrySchema = z.object({
  athlete: athleteRefSchema,
  teamSide: z.enum(['home', 'away']),
  pointsSoFar: z.number(),
})
export type LiveSubPoolEntry = z.infer<typeof liveSubPoolEntrySchema>

export const liveStateSchema = z.object({
  matchStatus: matchStatusSchema,
  currentMinute: z.number().int().nullable(),
  currentMinuteAt: z.string().nullable(),
  clockState: z.enum(['running', 'halftime']).default('running'),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  hostScore: z.number(),
  guestScore: z.number(),
  winner: roomWinnerSchema.nullable(),
  hostLineup: z.array(lineupSlotSchema),
  guestLineup: z.array(lineupSlotSchema),
  recentEvents: z.array(matchEventSchema),
  pool: z.array(liveSubPoolEntrySchema),
})
export type LiveState = z.infer<typeof liveStateSchema>

// WS payloads
export const matchSubstituteInputSchema = z.object({
  roomId: z.string().uuid(),
  removeAthleteId: z.string().uuid(),
  addAthleteId: z.string().uuid(),
})
export type MatchSubstituteInput = z.infer<typeof matchSubstituteInputSchema>

export const matchEventPayloadSchema = z.object({
  event: matchEventSchema,
  hostScore: z.number(),
  guestScore: z.number(),
})
export type MatchEventPayload = z.infer<typeof matchEventPayloadSchema>

export const matchEventCanceledPayloadSchema = z.object({
  eventId: z.string().uuid(),
  athleteId: z.string().uuid(),
  action: actionTypeSchema,
  minute: z.number().int(),
  hostScore: z.number(),
  guestScore: z.number(),
})
export type MatchEventCanceledPayload = z.infer<typeof matchEventCanceledPayloadSchema>

export const matchTickPayloadSchema = z.object({
  currentMinute: z.number().int(),
  currentMinuteAt: z.string(),
  clockState: z.enum(['running', 'halftime']).default('running'),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
})
export type MatchTickPayload = z.infer<typeof matchTickPayloadSchema>

export const matchSubstitutionAppliedPayloadSchema = z.object({
  role: roleSchema,
  removedAthlete: athleteRefSchema,
  addedAthlete: athleteRefSchema,
  minute: z.number().int(),
  hostScore: z.number(),
  guestScore: z.number(),
})
export type MatchSubstitutionAppliedPayload = z.infer<typeof matchSubstitutionAppliedPayloadSchema>

export const matchFinishedPayloadSchema = z.object({
  hostScore: z.number(),
  guestScore: z.number(),
  winner: roomWinnerSchema,
  finishedAt: z.string(),
})
export type MatchFinishedPayload = z.infer<typeof matchFinishedPayloadSchema>

export const lineupConfirmedPayloadSchema = z.object({
  matchId: z.string().uuid(),
})
export type LineupConfirmedPayload = z.infer<typeof lineupConfirmedPayloadSchema>
