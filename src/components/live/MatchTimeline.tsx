import type { MatchEvent } from '@/lib/contracts/live'
import { ACTION_LABELS } from '@/types/domain'
import { cn } from '@/lib/utils'
import { ACTION_ICONS } from '@/lib/actionIcons'

interface MatchTimelineProps {
  events: MatchEvent[]
}

export function MatchTimeline({ events }: MatchTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground bg-surface rounded-lg">
        Aguardando eventos...
      </div>
    )
  }

  // The 50-event cap lives in `useLiveSocket` (RECENT_EVENTS_CAP) for the
  // WS-push path; the server snapshot also caps at 50 per spec §6.2. Either
  // way the array reaching here is already bounded — no slice needed.
  return (
    <div className="bg-surface rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
      {events.map((evt) => {
        const isPositive = evt.points >= 0
        return (
          <div
            key={evt.id}
            className={cn(
              'flex items-baseline gap-2 px-3 py-2 text-sm border-b border-border/50',
              isPositive ? 'animate-flash-positive' : 'animate-flash-negative',
            )}
          >
            <span aria-hidden className="text-base leading-none">{ACTION_ICONS[evt.action]}</span>
            <span className="font-medium">{evt.athlete.shortName}</span>
            <span className="text-muted-foreground text-xs">
              {ACTION_LABELS[evt.action]}
              {evt.canceled && ' (ANULADO)'}
            </span>
            <span
              className={cn(
                'ml-auto font-semibold tabular-nums',
                isPositive ? 'text-event-positive' : 'text-event-negative',
              )}
            >
              {isPositive ? '+' : ''}
              {evt.points.toFixed(1)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
