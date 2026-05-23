import { POSITIONS, type Position } from '@/lib/contracts/catalog'
import type { DraftPickDto } from '@/lib/contracts/draft'
import type { Role } from '@/lib/contracts/rooms'

/** Returns the positions the given role still needs to draft. Order preserved. */
export function computePositionsRemaining(picks: DraftPickDto[], role: Role): Position[] {
  const filled = new Set(picks.filter((p) => p.role === role).map((p) => p.athlete.position))
  return POSITIONS.filter((p) => !filled.has(p))
}
