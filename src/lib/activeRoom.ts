import type { RoomSummaryDto } from '@/lib/contracts/rooms'

/**
 * Resolves which active room the user should return to for a given match.
 *
 * A user can end up in more than one active room for the same match (host of
 * one, guest of another). Prefer the room where the user is the HOST (their own
 * duel); otherwise fall back to the first match (the list arrives ordered by
 * createdAt desc from GET /me/rooms). Returns null when the user is in no active
 * room for the match — the match page then shows the "Criar sala" button.
 */
export function findActiveRoomForMatch(
  rooms: RoomSummaryDto[] | undefined,
  matchId: string,
): RoomSummaryDto | null {
  const forMatch = rooms?.filter((r) => r.match.id === matchId) ?? []
  if (forMatch.length === 0) return null
  return forMatch.find((r) => r.role === 'host') ?? forMatch[0]
}
