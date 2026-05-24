'use client'

import { cn } from '@/lib/utils'
import type { Position } from '@/lib/contracts/catalog'

/** Neutral team colors used when a team has no palette configured. */
const DEFAULT_TEAM_PRIMARY = '#1f2937'
const DEFAULT_TEAM_SECONDARY = '#ffffff'

interface PlayerCardProps {
  shortName: string
  position: Position
  teamPrimaryColor: string | null
  teamSecondaryColor: string | null
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
  teamPrimaryColor,
  teamSecondaryColor,
  score,
  onClick,
  isSelected,
  isRemoved,
  flashType,
  compact,
}: PlayerCardProps) {
  const primary = teamPrimaryColor ?? DEFAULT_TEAM_PRIMARY
  const secondary = teamSecondaryColor ?? DEFAULT_TEAM_SECONDARY
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
      <span
        aria-hidden
        className="w-2 h-6 rounded-sm shrink-0"
        style={{ backgroundColor: primary, border: `1px solid ${secondary}33` }}
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
