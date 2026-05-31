'use client'

import { useEffect, useState } from 'react'

/**
 * Interpolates the current match minute client-side between server ticks.
 *
 * The server emits a `match:tick` every minute with the authoritative minute
 * + the wall-clock timestamp it was anchored to. Between ticks we extrapolate
 * locally by counting whole elapsed minutes since `serverMinuteAt`, so the
 * minute counter in the UI keeps advancing without waiting for the next tick.
 *
 * While `clockState` is `'halftime'`, the minute is frozen at the
 * server-reported value (no local extrapolation), so the clock visibly stops
 * during the break. Returns `null` when either time input is null.
 */
export function useInterpolatedMinute(
  serverMinute: number | null,
  serverMinuteAt: string | null,
  clockState: 'running' | 'halftime' = 'running',
): number | null {
  const [now, setNow] = useState(() => Date.now())
  const frozen = clockState === 'halftime'

  useEffect(() => {
    if (serverMinute === null || serverMinuteAt === null || frozen) return
    // Re-anchor `now` immediately so a fresh server tick is reflected before
    // the first interval fires — otherwise we'd briefly compute against a
    // stale `now` captured at hook init.
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [serverMinute, serverMinuteAt, frozen])

  if (serverMinute === null || serverMinuteAt === null) return null
  if (frozen) return serverMinute
  const elapsedMs = now - new Date(serverMinuteAt).getTime()
  return serverMinute + Math.floor(elapsedMs / 60_000)
}
