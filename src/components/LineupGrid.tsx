import { PlayerCard } from '@/components/PlayerCard'
import { TeamIcon } from '@/components/TeamIcon'
import type { LineupEntryDto, MatchLineupsDto, TeamDto } from '@/lib/contracts/catalog'
import { POSITION_ORDER } from '@/types/domain'

const EXPECTED_FIELD_PLAYERS = 11

interface LineupGridProps {
  lineups: MatchLineupsDto
  homeTeam: TeamDto
  awayTeam: TeamDto
}

function sortByPosition(entries: LineupEntryDto[]): LineupEntryDto[] {
  return [...entries].sort((a, b) => {
    const aPos = POSITION_ORDER.indexOf(a.athlete.position)
    const bPos = POSITION_ORDER.indexOf(b.athlete.position)
    if (aPos !== bPos) return aPos - bPos
    return (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99)
  })
}

function PendingPlayerCard() {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-dashed border-border">
      <span className="px-1.5 py-0.5 text-[0.65rem] font-semibold rounded bg-secondary text-muted-foreground uppercase tracking-wider">
        ?
      </span>
      <span className="text-sm text-muted-foreground italic">A confirmar</span>
    </div>
  )
}

function TeamColumn({
  team,
  entries,
}: {
  team: TeamDto
  entries: LineupEntryDto[]
}) {
  const missingCount = Math.max(0, EXPECTED_FIELD_PLAYERS - entries.length)

  return (
    <div>
      <header className="flex items-center gap-2 mb-3">
        <TeamIcon
          size="sm"
          imageUrl={team.imageUrl}
          primaryColor={team.primaryColor}
          secondaryColor={team.secondaryColor}
        />
        <span className="text-sm font-semibold">{team.abbreviation}</span>
        {missingCount > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">{entries.length}/11</span>
        )}
      </header>
      <div className="space-y-1">
        {sortByPosition(entries).map((e) => (
          <PlayerCard
            key={e.athlete.id}
            shortName={e.athlete.shortName}
            position={e.athlete.position}
            jerseyNumber={e.jerseyNumber}
            teamPrimaryColor={team.primaryColor}
            teamSecondaryColor={team.secondaryColor}
            compact
          />
        ))}
        {Array.from({ length: missingCount }, (_, i) => (
          <PendingPlayerCard key={`pending-${i}`} />
        ))}
      </div>
    </div>
  )
}

export function LineupGrid({ lineups, homeTeam, awayTeam }: LineupGridProps) {
  if (lineups.confirmedAt === null) {
    return (
      <div className="rounded-lg bg-surface px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">Escalações ainda não confirmadas.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <TeamColumn team={homeTeam} entries={lineups.home.filter((e) => e.isStarter)} />
      <TeamColumn team={awayTeam} entries={lineups.away.filter((e) => e.isStarter)} />
    </div>
  )
}
