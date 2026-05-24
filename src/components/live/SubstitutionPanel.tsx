import type { LiveSubPoolEntry } from '@/lib/contracts/live'
import type { AthleteRefDto } from '@/lib/contracts/draft'
import { JerseyIcon } from '@/components/JerseyIcon'

interface SubstitutionPanelProps {
  selectedToRemove: AthleteRefDto
  pool: LiveSubPoolEntry[]
  onPick: (athleteId: string) => void
}

export function SubstitutionPanel({
  selectedToRemove,
  pool,
  onPick,
}: SubstitutionPanelProps) {
  const candidates = pool.filter(
    (p) => p.athlete.position === selectedToRemove.position,
  )

  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Escolha o substituto ({selectedToRemove.position})
      </h2>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">
          Nenhum jogador disponível para essa posição.
        </p>
      ) : (
        candidates.map((entry) => (
          <button
            key={entry.athlete.id}
            type="button"
            data-testid={`sub-candidate-${entry.athlete.id}`}
            onClick={() => onPick(entry.athlete.id)}
            className="w-full flex items-center gap-2 p-2 rounded bg-surface hover:bg-accent"
          >
            <JerseyIcon
              jerseyNumber={entry.athlete.jerseyNumber}
              primaryColor="#666"
              secondaryColor="#fff"
              size="sm"
            />
            <span className="flex-1 text-left text-sm font-medium">
              {entry.athlete.shortName}
            </span>
            <span className="text-xs text-muted-foreground">{entry.athlete.position}</span>
            <span className="tabular-nums text-sm font-semibold">
              {entry.pointsSoFar.toFixed(1)}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
