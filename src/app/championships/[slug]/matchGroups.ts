import type { MatchSummaryDto } from '@/lib/contracts/catalog'

export interface MatchDayGroup {
  /** `YYYY-MM-DD` of the local calendar day — stable React key and sort key. */
  key: string
  /** Day rendered by extenso, e.g. "Sábado, 31 de maio". */
  label: string
  matches: MatchSummaryDto[]
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function formatDayLabel(iso: string): string {
  const label = new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Buckets matches by the day they kick off on, with days in ascending order and
 * matches within each day ordered by ascending kickoff.
 */
export function groupMatchesByDay(matches: MatchSummaryDto[]): MatchDayGroup[] {
  const buckets = new Map<string, MatchSummaryDto[]>()
  for (const match of matches) {
    const key = dayKey(match.kickoffAt)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(match)
    else buckets.set(key, [match])
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayMatches]) => ({
      key,
      label: formatDayLabel(dayMatches[0].kickoffAt),
      matches: [...dayMatches].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)),
    }))
}
