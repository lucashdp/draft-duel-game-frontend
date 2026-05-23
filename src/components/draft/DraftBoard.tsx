'use client'

import { cn } from '@/lib/utils'
import { PlayerCard } from '@/components/PlayerCard'
import type { DraftPickDto } from '@/lib/contracts/draft'
import type { Role, TeamRefDto } from '@/lib/contracts/rooms'

const SNAKE_ORDER: Role[] = ['host', 'guest', 'guest', 'host', 'host', 'guest', 'guest', 'host', 'host', 'guest']

interface Props {
  picks: DraftPickDto[]
  currentPickNumber: number
  homeTeam: TeamRefDto
  awayTeam: TeamRefDto
}

export function DraftBoard({ picks, currentPickNumber, homeTeam, awayTeam }: Props) {
  const byPickNumber = new Map(picks.map((p) => [p.pickNumber, p]))

  function teamFor(pick: DraftPickDto): TeamRefDto {
    return pick.athlete.teamId === homeTeam.id ? homeTeam : awayTeam
  }

  function renderSlot(pickNumber: number) {
    const pick = byPickNumber.get(pickNumber)
    const isCurrent = pickNumber === currentPickNumber

    if (!pick) {
      return (
        <div
          key={pickNumber}
          data-testid={isCurrent ? 'draft-slot-current' : 'draft-slot-empty'}
          data-pick-number={String(pickNumber)}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground',
            isCurrent && 'border-primary text-primary',
          )}
        >
          <span className="font-semibold tabular-nums">#{pickNumber + 1}</span>
          <span>{isCurrent ? 'Próximo pick' : 'Vazio'}</span>
        </div>
      )
    }

    const team = teamFor(pick)
    return (
      <div
        key={pickNumber}
        data-testid="draft-slot-filled"
        data-pick-number={String(pickNumber)}
        className="flex items-center gap-2"
      >
        <span className="text-xs font-semibold tabular-nums text-muted-foreground w-6">#{pickNumber + 1}</span>
        <div className="flex-1">
          <PlayerCard
            shortName={pick.athlete.shortName}
            position={pick.athlete.position}
            jerseyNumber={pick.athlete.jerseyNumber}
            teamPrimaryColor={team.primaryColor ?? '#1f2937'}
            teamSecondaryColor={team.secondaryColor ?? '#ffffff'}
          />
        </div>
      </div>
    )
  }

  const hostSlots = SNAKE_ORDER.map((role, idx) => role === 'host' ? idx : null).filter((n): n is number => n !== null)
  const guestSlots = SNAKE_ORDER.map((role, idx) => role === 'guest' ? idx : null).filter((n): n is number => n !== null)

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Host</p>
        {hostSlots.map((n) => renderSlot(n))}
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Guest</p>
        {guestSlots.map((n) => renderSlot(n))}
      </div>
    </div>
  )
}
