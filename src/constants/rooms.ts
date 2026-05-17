import { env } from '@/lib/env'

/** Frontend route prefix for the public invite link. */
export const INVITE_PATH_PREFIX = '/rooms/join'

/** Build the full invite URL the host shares with the guest.
 *  Uses NEXT_PUBLIC_WEB_ORIGIN when available; falls back to window.location.origin at runtime.
 */
export function buildInviteUrl(code: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${INVITE_PATH_PREFIX}/${code}`
  }
  // SSR fallback — should rarely render server-side, but keeps types safe.
  return `${env.NEXT_PUBLIC_WEB_ORIGIN ?? ''}${INVITE_PATH_PREFIX}/${code}`
}

/** Refetch interval for safety on the lobby (in case WS missed a transition). */
export const LOBBY_REFETCH_MS = 60_000

/** TanStack stale time for room snapshots — short, but avoids refetch storms. */
export const ROOM_STALE_MS = 5_000
