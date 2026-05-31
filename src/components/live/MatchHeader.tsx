import { Radio } from 'lucide-react'
import { TeamIcon } from '@/components/TeamIcon'
import type { MatchStatus } from '@/lib/contracts/live'

type Team = {
  id: string
  name: string
  shortName: string
  abbreviation: string
  imageUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

interface MatchHeaderProps {
  homeTeam: Team
  awayTeam: Team
  homeScore: number | null
  awayScore: number | null
  matchStatus: MatchStatus
  minute: number | null
}

function TeamSide({ team }: { team: Team }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <TeamIcon
        size="sm"
        imageUrl={team.imageUrl}
        primaryColor={team.primaryColor ?? '#1f2937'}
        secondaryColor={team.secondaryColor ?? '#ffffff'}
      />
      <span className="hidden sm:block font-bold text-lg truncate">{team.shortName}</span>
      <span className="sm:hidden font-bold text-base">{team.abbreviation}</span>
    </div>
  )
}

export function MatchHeader({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  matchStatus,
  minute,
}: MatchHeaderProps) {
  return (
    <div className="bg-surface rounded-lg p-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <TeamSide team={homeTeam} />
        <span className="text-2xl font-bold tabular-nums">{homeScore ?? '-'}</span>
        <span className="text-muted-foreground">×</span>
        <span className="text-2xl font-bold tabular-nums">{awayScore ?? '-'}</span>
        <TeamSide team={awayTeam} />
      </div>
      <div className="flex items-center gap-2 text-sm shrink-0">
        {matchStatus === 'live' && (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <Radio size={12} className="animate-pulse" />
            <span className="hidden sm:inline">AO VIVO</span>
          </span>
        )}
        {matchStatus === 'finished' && (
          <span className="text-muted-foreground font-semibold">FIM</span>
        )}
        <span className="tabular-nums text-muted-foreground">
          {minute !== null ? `${minute}'` : '--'}
        </span>
      </div>
    </div>
  )
}
