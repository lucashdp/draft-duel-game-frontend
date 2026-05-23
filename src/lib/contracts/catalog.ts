import { z } from 'zod'

export const championshipKindSchema = z.enum(['league', 'cup'])

export const championshipSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  kind: championshipKindSchema,
})
export type ChampionshipDto = z.infer<typeof championshipSchema>

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected #RRGGBB')

export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
  imageUrl: z.string().nullable(),
  primaryColor: hexColor,
  secondaryColor: hexColor,
})
export type TeamDto = z.infer<typeof teamSchema>

export const matchStatusSchema = z.enum(['scheduled', 'live', 'finished', 'postponed'])

export const matchSummarySchema = z.object({
  id: z.string().uuid(),
  championshipId: z.string().uuid(),
  kickoffAt: z.string(),
  status: matchStatusSchema,
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  currentMinute: z.number().nullable(),
  lineupsConfirmedAt: z.string().nullable(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
})
export type MatchSummaryDto = z.infer<typeof matchSummarySchema>

export const currentRoundSchema = z.object({
  championship: championshipSchema,
  round: z.object({
    id: z.string().uuid(),
    number: z.number(),
    name: z.string(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  }),
  matches: z.array(matchSummarySchema),
})
export type CurrentRoundDto = z.infer<typeof currentRoundSchema>

/** Canonical order of mandatory draft positions. */
export const POSITIONS = ['GOL', 'LAT', 'ZAG', 'MEI', 'ATA'] as const
export const positionSchema = z.enum(POSITIONS)
export type Position = z.infer<typeof positionSchema>

export const athleteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string(),
  position: positionSchema,
  jerseyNumber: z.number().nullable(),
  team: teamSchema,
})
export type AthleteDto = z.infer<typeof athleteSchema>

export const lineupEntrySchema = z.object({
  athlete: athleteSchema,
  isStarter: z.boolean(),
  jerseyNumber: z.number(),
})
export type LineupEntryDto = z.infer<typeof lineupEntrySchema>

export const matchLineupsSchema = z.object({
  matchId: z.string().uuid(),
  confirmedAt: z.string().nullable(),
  home: z.array(lineupEntrySchema),
  away: z.array(lineupEntrySchema),
})
export type MatchLineupsDto = z.infer<typeof matchLineupsSchema>
