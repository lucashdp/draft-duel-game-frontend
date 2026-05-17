import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { MatchSummaryDto, TeamDto } from '@/lib/contracts/catalog'

interface MatchCardProps {
  match: MatchSummaryDto
  className?: string
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TeamBadge({ team, align }: { team: TeamDto; align: 'left' | 'right' }) {
  return (
    <div
      className={cn('flex items-center gap-2 min-w-0', align === 'right' && 'flex-row-reverse')}
    >
      <div
        className="w-8 h-8 rounded shrink-0"
        style={{ backgroundColor: team.primaryColor, border: `1px solid ${team.secondaryColor}33` }}
      />
      <span className="text-sm font-semibold tabular-nums">{team.abbreviation}</span>
    </div>
  )
}

export function MatchCard({ match, className }: MatchCardProps) {
  const showScore = match.status === 'live' || match.status === 'finished'

  return (
    <article data-testid="match-card">
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        'block rounded-lg bg-surface px-4 py-3 transition-all',
        'hover:bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        className,
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamBadge team={match.homeTeam} align="left" />

        <div className="flex flex-col items-center gap-0.5 min-w-[3rem]">
          {showScore ? (
            <div className="flex items-center gap-2 text-lg font-bold tabular-nums">
              <span>{match.homeScore ?? 0}</span>
              <span className="text-muted-foreground">·</span>
              <span>{match.awayScore ?? 0}</span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">
              {formatKickoff(match.kickoffAt)}
            </span>
          )}
          <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
            {match.status === 'live' && match.currentMinute !== null
              ? `${match.currentMinute}'`
              : match.status === 'finished'
                ? 'Encerrado'
                : match.status === 'postponed'
                  ? 'Adiado'
                  : ''}
          </span>
        </div>

        <TeamBadge team={match.awayTeam} align="right" />
      </div>
    </Link>
    </article>
  )
}
