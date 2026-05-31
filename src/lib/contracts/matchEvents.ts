import { z } from 'zod'
import { actionTypeSchema } from './live'
import { positionSchema } from './catalog'

export const matchEventEntrySchema = z.object({
  id: z.string().uuid(),
  athlete: z.object({
    id: z.string().uuid(),
    name: z.string(),
    shortName: z.string(),
    position: positionSchema,
    jerseyNumber: z.number().int().nullable(),
    teamId: z.string().uuid(),
  }),
  action: actionTypeSchema,
  minute: z.number().int(),
  occurredAt: z.string(),
})
export type MatchEventEntryDto = z.infer<typeof matchEventEntrySchema>

export const matchEventsResponseSchema = z.array(matchEventEntrySchema)
export type MatchEventsResponseDto = z.infer<typeof matchEventsResponseSchema>
