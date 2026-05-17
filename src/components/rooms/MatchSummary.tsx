import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

interface Props {
  match: RoomSnapshotDto['match']
}

export function MatchSummary({ match }: Props) {
  const date = new Date(match.kickoffAt)
  const formatted = date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="rounded-lg border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
        {formatted}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-base font-medium">{match.homeTeam.name}</span>
        <span className="text-sm text-muted-foreground">vs</span>
        <span className="text-base font-medium">{match.awayTeam.name}</span>
      </div>
    </div>
  )
}
