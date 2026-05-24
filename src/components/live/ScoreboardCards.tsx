import { cn } from '@/lib/utils'

interface ScoreboardCardsProps {
  myName: string
  oppName: string
  myScore: number
  oppScore: number
  canSub: boolean
  subMode: boolean
  onToggleSub: () => void
}

export function ScoreboardCards({
  myName,
  oppName,
  myScore,
  oppScore,
  canSub,
  subMode,
  onToggleSub,
}: ScoreboardCardsProps) {
  const iWinning = myScore > oppScore
  const oppWinning = oppScore > myScore

  return (
    <div className="grid grid-cols-2 gap-3">
      <div
        data-testid="my-card"
        className={cn(
          'bg-surface rounded-lg p-3 text-center',
          iWinning && 'text-event-positive',
          canSub && 'ring-2 ring-primary',
        )}
      >
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          {myName} (Você)
        </div>
        <div className="text-3xl font-bold tabular-nums">{myScore.toFixed(1)}</div>
        {canSub && (
          <>
            <div className="text-[0.65rem] text-primary font-semibold mt-1">
              Substituição disponível
            </div>
            <button
              type="button"
              onClick={onToggleSub}
              className={cn(
                'mt-2 px-3 py-1 rounded text-xs font-semibold',
                subMode
                  ? 'bg-destructive text-foreground'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {subMode ? 'Cancelar' : 'Substituir'}
            </button>
          </>
        )}
      </div>
      <div
        data-testid="opp-card"
        className={cn(
          'bg-surface rounded-lg p-3 text-center',
          oppWinning && 'text-event-positive',
        )}
      >
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          {oppName}
        </div>
        <div className="text-3xl font-bold tabular-nums">{oppScore.toFixed(1)}</div>
      </div>
    </div>
  )
}
