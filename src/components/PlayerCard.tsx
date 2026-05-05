'use client'

import { cn } from '@/lib/utils'
import { JerseyIcon } from '@/components/JerseyIcon'
import type { Position } from '@/types/domain'

interface PlayerCardProps {
  shortName: string
  position: Position
  jerseyNumber: number | null
  teamPrimaryColor: string
  teamSecondaryColor: string
  score?: number
  onClick?: () => void
  isSelected?: boolean
  isRemoved?: boolean
  flashType?: 'positive' | 'negative' | null
  compact?: boolean
}

export function PlayerCard({
  shortName,
  position,
  jerseyNumber,
  teamPrimaryColor,
  teamSecondaryColor,
  score,
  onClick,
  isSelected,
  isRemoved,
  flashType,
  compact,
}: PlayerCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface transition-all',
        onClick && 'cursor-pointer hover:bg-accent',
        isSelected ? 'ring-2 ring-primary' : 'shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        isRemoved && 'opacity-30',
        flashType === 'positive' && 'animate-flash-positive',
        flashType === 'negative' && 'animate-flash-negative',
        compact && 'py-1',
      )}
    >
      <span className="px-1.5 py-0.5 text-[0.65rem] font-semibold rounded bg-secondary text-muted-foreground uppercase tracking-wider">
        {position}
      </span>
      <JerseyIcon
        jerseyNumber={jerseyNumber}
        primaryColor={teamPrimaryColor}
        secondaryColor={teamSecondaryColor}
        size="sm"
      />
      <span className="text-sm font-medium truncate flex-1">{shortName}</span>
      {score !== undefined && (
        <span
          className={cn(
            'text-sm font-semibold tabular-nums min-w-[3rem] text-right',
            score > 0
              ? 'text-event-positive'
              : score < 0
                ? 'text-event-negative'
                : 'text-muted-foreground',
          )}
        >
          {score.toFixed(1)}
        </span>
      )}
    </div>
  )
}
