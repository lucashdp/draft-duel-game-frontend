import { z } from 'zod'

/** Wire format = lowercase (mirrors API's mapper output, matches src/types/domain.ts). */
const ROLE_VALUES = ['host', 'guest'] as const
export const Role = {
  HOST: ROLE_VALUES[0],
  GUEST: ROLE_VALUES[1],
} as const
export type Role = (typeof ROLE_VALUES)[number]

export const roleSchema = z.enum(ROLE_VALUES)
