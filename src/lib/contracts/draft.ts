import { z } from 'zod'
import { positionSchema } from '@/lib/contracts/catalog'
import { roleSchema } from '@/lib/contracts/shared'

export const TEAM_SIDES = ['home', 'away'] as const
export type TeamSide = (typeof TEAM_SIDES)[number]
export const teamSideSchema = z.enum(TEAM_SIDES)

export const athleteRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string(),
  position: positionSchema,
  jerseyNumber: z.number().int().nullable(),
  teamId: z.string().uuid(),
})
export type AthleteRefDto = z.infer<typeof athleteRefSchema>

export const draftPickSchema = z.object({
  pickNumber: z.number().int().min(0).max(9),
  role: roleSchema,
  athlete: athleteRefSchema,
  madeAt: z.string().datetime(),
})
export type DraftPickDto = z.infer<typeof draftPickSchema>

export const draftPoolEntrySchema = z.object({
  athlete: athleteRefSchema,
  teamSide: teamSideSchema,
  pickedByRole: roleSchema.nullable(),
})
export type DraftPoolEntryDto = z.infer<typeof draftPoolEntrySchema>

export const draftStateSchema = z.object({
  currentPickNumber: z.number().int().min(0).max(10),
  currentRole: roleSchema.nullable(),
  lineupReady: z.boolean(),
  picks: z.array(draftPickSchema),
  pool: z.array(draftPoolEntrySchema),
})
export type DraftStateDto = z.infer<typeof draftStateSchema>

// WS payloads
export const draftPickMadePayloadSchema = z.object({
  pick: draftPickSchema,
  nextPickNumber: z.number().int().min(0).max(10).nullable(),
  currentRole: roleSchema.nullable(),
})
export type DraftPickMadePayload = z.infer<typeof draftPickMadePayloadSchema>

export const draftCurrentPickPayloadSchema = z.object({
  pickNumber: z.number().int().min(0).max(9),
  role: roleSchema,
})
export type DraftCurrentPickPayload = z.infer<typeof draftCurrentPickPayloadSchema>

export const matchStartedPayloadSchema = z.object({
  startedAt: z.string().datetime(),
  hostLineup: z.array(athleteRefSchema),
  guestLineup: z.array(athleteRefSchema),
})
export type MatchStartedPayload = z.infer<typeof matchStartedPayloadSchema>
