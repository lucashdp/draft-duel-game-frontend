import { Radio } from 'lucide-react'
import type { MatchStatus } from '@/lib/contracts/live'

type Team = { id: string; name: string; shortName: string }

interface MatchHeaderProps {
  homeTeam: Team
  awayTeam: Team
  homeScore: number | null
  awayScore: number | null
  matchStatus: MatchStatus
  minute: number | null
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
    <div className="bg-surface rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg">{homeTeam.shortName}</span>
        <span className="text-2xl font-bold tabular-nums">{homeScore ?? '-'}</span>
        <span className="text-muted-foreground">×</span>
        <span className="text-2xl font-bold tabular-nums">{awayScore ?? '-'}</span>
        <span className="font-bold text-lg">{awayTeam.shortName}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {matchStatus === 'live' && (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <Radio size={12} className="animate-pulse" /> AO VIVO
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
