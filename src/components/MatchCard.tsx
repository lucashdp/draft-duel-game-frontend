import Link from 'next/link'
import { Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TeamIcon } from '@/components/TeamIcon'
import { resolveMatchPalettes } from '@/lib/teamColors'
import type { MatchSummaryDto, MatchTeamSummaryDto } from '@/lib/contracts/catalog'

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

const FORM_STYLES = {
  V: { color: '#22c55e', label: 'Vitória' },
  E: { color: '#eab308', label: 'Empate' },
  D: { color: '#ef4444', label: 'Derrota' },
} as const

function FormBadge({ result }: { result: 'V' | 'E' | 'D' }) {
  const { color, label } = FORM_STYLES[result]
  return (
    <span
      data-testid="form-badge"
      title={label}
      aria-label={label}
      className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[0.55rem] font-bold leading-none text-white"
      style={{ backgroundColor: color }}
    >
      {result}
    </span>
  )
}

function TeamBadge({
  team,
  align,
  palette,
}: {
  team: MatchTeamSummaryDto
  align: 'left' | 'right'
  palette: { primary: string; secondary: string }
}) {
  const alignRight = align === 'right'
  return (
    <div className={cn('flex flex-col gap-1 min-w-0', alignRight ? 'items-end' : 'items-start')}>
      <div className={cn('flex items-center gap-2 min-w-0', alignRight && 'flex-row-reverse')}>
        <TeamIcon
          size="md"
          imageUrl={team.imageUrl}
          primaryColor={palette.primary}
          secondaryColor={palette.secondary}
        />
        <span className="hidden sm:block text-sm font-semibold truncate">{team.shortName}</span>
        <span className="sm:hidden text-sm font-semibold tabular-nums">{team.abbreviation}</span>
      </div>

      {team.position !== null && (
        <span className="text-[0.65rem] text-muted-foreground tabular-nums">
          {alignRight ? `${team.position}º lugar 🏆` : `🏆 ${team.position}º lugar`}
        </span>
      )}

      {team.form.length > 0 && (
        <div className="flex gap-0.5">
          {team.form.map((result, i) => (
            <FormBadge key={i} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}

export function MatchCard({ match, className }: MatchCardProps) {
  // The backend can roll a finished match back to "scheduled" on a later calendar sync
  // (Cartola drops periodo_tr) while preserving its score. Trust the score, not just the
  // status: a scheduled match that already has a result is really a played one.
  const hasScore = match.homeScore !== null && match.awayScore !== null
  const isPlayed = match.status === 'finished' || (match.status === 'scheduled' && hasScore)
  const showScore = match.status === 'live' || isPlayed
  const palettes = resolveMatchPalettes(match.homeTeam, match.awayTeam)
  const isLive = match.status === 'live'

  return (
    <Link
      data-testid="match-card"
      href={`/matches/${match.id}`}
      className={cn(
        'block rounded-lg bg-surface px-4 py-3 transition-all',
        'hover:bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        className,
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <TeamBadge team={match.homeTeam} align="left" palette={palettes.home} />

        <div className="flex flex-col items-center gap-0.5 min-w-[3rem] pt-1">
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
          {isLive && match.currentMinute !== null ? (
            <span
              data-testid="live-indicator"
              className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-wider text-event-positive"
            >
              <Radio size={11} className="animate-pulse" />
              {match.currentMinute}&apos;
            </span>
          ) : (
            <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
              {isPlayed
                ? 'Encerrado'
                : match.status === 'postponed'
                  ? 'Adiado'
                  : match.status === 'canceled'
                    ? 'Cancelado'
                    : ''}
            </span>
          )}
          {match.venue !== null && (
            <span className="flex items-center gap-1 max-w-[7rem] text-[0.6rem] text-muted-foreground">
              <span aria-hidden>🏟️</span>
              <span className="truncate">{match.venue}</span>
            </span>
          )}
        </div>

        <TeamBadge team={match.awayTeam} align="right" palette={palettes.away} />
      </div>
    </Link>
  )
}
