import type { MatchEventEntryDto } from '@/lib/contracts/matchEvents'
import { ACTION_ICONS } from '@/lib/actionIcons'
import { ACTION_LABELS } from '@/types/domain'

interface Props {
  events: MatchEventEntryDto[]
}

export function MatchEventsTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground bg-surface rounded-lg">
        Ainda sem eventos nesta partida.
      </div>
    )
  }
  return (
    <div className="bg-surface rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
      {events.map((evt) => (
        <div key={evt.id} className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border/50 last:border-b-0">
          <span aria-hidden className="text-base leading-none">{ACTION_ICONS[evt.action]}</span>
          <span className="text-xs text-muted-foreground tabular-nums w-8">{evt.minute}&apos;</span>
          <span className="font-medium truncate">{evt.athlete.shortName}</span>
          <span className="ml-auto text-muted-foreground text-xs">{ACTION_LABELS[evt.action]}</span>
        </div>
      ))}
    </div>
  )
}
