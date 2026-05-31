import type { RoomSummaryDto } from '@/lib/contracts/rooms'

export function findActiveRoomForMatch(
  rooms: RoomSummaryDto[] | undefined,
  matchId: string,
): RoomSummaryDto | null {
  return rooms?.find((r) => r.match.id === matchId) ?? null
}
