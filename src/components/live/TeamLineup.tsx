import type { LineupSlot } from '@/lib/contracts/live'
import type { AthleteRefDto } from '@/lib/contracts/draft'
import { JerseyIcon } from '@/components/JerseyIcon'
import { POSITION_ORDER } from '@/types/domain'
import { cn } from '@/lib/utils'
import { paletteForSide, sideForTeamId, type Palette } from '@/lib/teamColors'

interface TeamLineupProps {
  title: string
  lineup: LineupSlot[]
  palettes: { home: Palette; away: Palette }
  homeTeamId: string
  subMode?: boolean
  selectedId?: string | null
  onSelectRemove?: (athlete: AthleteRefDto) => void
}

export function TeamLineup({
  title,
  lineup,
  palettes,
  homeTeamId,
  subMode = false,
  selectedId = null,
  onSelectRemove,
}: TeamLineupProps) {
  const sorted = [...lineup].sort(
    (a, b) => POSITION_ORDER.indexOf(a.athlete.position) - POSITION_ORDER.indexOf(b.athlete.position),
  )
  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      {sorted.map((slot) => {
        const palette = paletteForSide(palettes, sideForTeamId(slot.athlete.teamId, homeTeamId))
        return (
          <button
            key={slot.athlete.id}
            type="button"
            data-testid={`lineup-slot-${slot.athlete.id}`}
            disabled={!subMode}
            onClick={() => { if (subMode) onSelectRemove?.(slot.athlete) }}
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded bg-surface',
              selectedId === slot.athlete.id && 'ring-2 ring-primary',
              subMode ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
            )}
          >
            <JerseyIcon jerseyNumber={slot.athlete.jerseyNumber} primaryColor={palette.primary} secondaryColor={palette.secondary} size="sm" />
            <span className="flex-1 text-left text-sm font-medium truncate">{slot.athlete.shortName}</span>
            <span className="text-xs text-muted-foreground">{slot.athlete.position}</span>
            <span className="tabular-nums text-sm font-semibold">{slot.cumulativePoints.toFixed(1)}</span>
          </button>
        )
      })}
    </div>
  )
}
