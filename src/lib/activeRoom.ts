import type { RoomSummaryDto } from '@/lib/contracts/rooms'

/**
 * Resolves which active room the user should return to for a given match.
 *
 * A user can end up in more than one active room for the same match (host of
 * one, guest of another, or — rarely — host of two if an older room didn't
 * close cleanly). Prefer the room where the user is the HOST (their own duel);
 * if multiple matches, the input order wins. The list arrives ordered by
 * createdAt desc from GET /me/rooms and `.filter` preserves that order, so
 * both branches (host match and the `forMatch[0]` fallback) resolve to the
 * most recent room. Returns null when the user is in no active room for the
 * match — the match page then shows the "Criar sala" button.
 */
export function findActiveRoomForMatch(
  rooms: RoomSummaryDto[] | undefined,
  matchId: string,
): RoomSummaryDto | null {
  const forMatch = rooms?.filter((r) => r.match.id === matchId) ?? []
  if (forMatch.length === 0) return null
  return forMatch.find((r) => r.role === 'host') ?? forMatch[0]
}
