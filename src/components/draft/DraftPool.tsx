'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PlayerCard } from '@/components/PlayerCard'
import { type Position } from '@/lib/contracts/catalog'
import { POSITIONS } from '@/lib/draft-positions-remaining'
import type { DraftPoolEntryDto } from '@/lib/contracts/draft'
import type { TeamRefDto } from '@/lib/contracts/rooms'

interface Props {
  pool: DraftPoolEntryDto[]
  disabled: boolean
  lineupReady: boolean
  homeTeam: TeamRefDto
  awayTeam: TeamRefDto
  positionsRemaining: Position[]
  onPick: (athleteId: string) => void
  onRefresh: () => void
}

export function DraftPool({
  pool,
  disabled,
  lineupReady,
  homeTeam,
  awayTeam,
  positionsRemaining,
  onPick,
  onRefresh,
}: Props) {
  const [positionFilter, setPositionFilter] = useState<Position | null>(null)

  if (!lineupReady) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Escalação ainda não confirmada pelo provedor.
        </p>
        <Button variant="outline" onClick={onRefresh}>
          Atualizar escalação
        </Button>
      </div>
    )
  }

  function filterPool(side: 'home' | 'away') {
    return pool
      .filter((e) => e.teamSide === side)
      .filter((e) => positionFilter === null || e.athlete.position === positionFilter)
  }

  function renderEntry(entry: DraftPoolEntryDto, team: TeamRefDto) {
    const isPicked = entry.pickedByRole !== null
    const positionExhausted = !positionsRemaining.includes(entry.athlete.position)
    const isInteractive = !disabled && !isPicked && !positionExhausted
    return (
      <div
        key={entry.athlete.id}
        className={cn(
          (isPicked || positionExhausted) && 'opacity-40',
          !isInteractive && 'pointer-events-none',
        )}
        aria-disabled={!isInteractive || undefined}
      >
        <PlayerCard
          shortName={entry.athlete.shortName}
          position={entry.athlete.position}
          jerseyNumber={entry.athlete.jerseyNumber}
          teamPrimaryColor={team.primaryColor ?? '#1f2937'}
          teamSecondaryColor={team.secondaryColor ?? '#ffffff'}
          onClick={isInteractive ? () => onPick(entry.athlete.id) : undefined}
        />
        {isPicked && (
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground pl-2 pt-0.5">
            picked by @{entry.pickedByRole}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={positionFilter === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPositionFilter(null)}
        >
          Todos
        </Button>
        {POSITIONS.map((p) => (
          <Button
            key={p}
            variant={positionFilter === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPositionFilter(p)}
            disabled={!positionsRemaining.includes(p)}
          >
            {p}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{homeTeam.shortName}</p>
          {filterPool('home').map((e) => renderEntry(e, homeTeam))}
        </section>
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{awayTeam.shortName}</p>
          {filterPool('away').map((e) => renderEntry(e, awayTeam))}
        </section>
      </div>
    </div>
  )
}
