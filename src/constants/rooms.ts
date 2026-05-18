import { env } from '@/lib/env'

/** Frontend route prefix for the public invite link. */
export const INVITE_PATH_PREFIX = '/rooms/join'

/** Build the full invite URL the host shares with the guest.
 *  Prefers window.location.origin at runtime; falls back to NEXT_PUBLIC_WEB_ORIGIN for SSR.
 */
export function buildInviteUrl(code: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : env.NEXT_PUBLIC_WEB_ORIGIN
  return `${origin}${INVITE_PATH_PREFIX}/${code}`
}

/** Refetch interval for safety on the lobby (in case WS missed a transition). */
export const LOBBY_REFETCH_MS = 60_000

/** TanStack stale time for room snapshots — short, but avoids refetch storms. */
export const ROOM_STALE_MS = 5_000
