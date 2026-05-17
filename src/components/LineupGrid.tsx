import { PlayerCard } from '@/components/PlayerCard'
import type { LineupEntryDto, MatchLineupsDto, TeamDto } from '@/lib/contracts/catalog'
import { POSITION_ORDER } from '@/types/domain'

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
    return a.jerseyNumber - b.jerseyNumber
  })
}

function TeamColumn({
  team,
  entries,
}: {
  team: TeamDto
  entries: LineupEntryDto[]
}) {
  return (
    <div>
      <header className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded shrink-0"
          style={{ backgroundColor: team.primaryColor, border: `1px solid ${team.secondaryColor}33` }}
        />
        <span className="text-sm font-semibold">{team.abbreviation}</span>
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
      <TeamColumn team={homeTeam} entries={lineups.home} />
      <TeamColumn team={awayTeam} entries={lineups.away} />
    </div>
  )
}
