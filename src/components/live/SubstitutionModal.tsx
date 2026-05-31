'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { JerseyIcon } from '@/components/JerseyIcon'
import { cn } from '@/lib/utils'
import type { LineupSlot, LiveSubPoolEntry } from '@/lib/contracts/live'
import { paletteForSide, sideForTeamId, type Palette } from '@/lib/teamColors'

interface Props {
  open: boolean
  lineup: LineupSlot[]
  pool: LiveSubPoolEntry[]
  palettes: { home: Palette; away: Palette }
  homeTeamId: string
  loading: boolean
  onClose: () => void
  onConfirm: (removeAthleteId: string, addAthleteId: string) => void
}

export function SubstitutionModal({
  open,
  lineup,
  pool,
  palettes,
  homeTeamId,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [addId, setAddId] = useState<string | null>(null)

  const removed = lineup.find((s) => s.athlete.id === removeId)?.athlete ?? null
  const candidates = removed ? pool.filter((p) => p.athlete.position === removed.position) : []
  const added = pool.find((p) => p.athlete.id === addId)?.athlete ?? null

  const reset = () => { setStep(1); setRemoveId(null); setAddId(null) }
  const close = () => { reset(); onClose() }

  const palette = (teamId: string) => paletteForSide(palettes, sideForTeamId(teamId, homeTeamId))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Substituir jogador</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1" aria-label={`Passo ${step} de 3`}>
          <Stepper step={step} />
          <span>
            {step === 1 ? 'Passo 1 de 3 · Quem sai?' : step === 2 ? 'Passo 2 de 3 · Quem entra?' : 'Passo 3 de 3 · Confirmar'}
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-1.5">
            {lineup.map((slot) => (
              <Row
                key={slot.athlete.id}
                label={slot.athlete.shortName}
                position={slot.athlete.position}
                points={slot.cumulativePoints}
                palette={palette(slot.athlete.teamId)}
                selected={removeId === slot.athlete.id}
                onClick={() => setRemoveId(slot.athlete.id)}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-1.5">
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">Nenhum jogador disponível para essa posição.</p>
            ) : (
              candidates.map((entry) => (
                <Row
                  key={entry.athlete.id}
                  label={entry.athlete.shortName}
                  position={entry.athlete.position}
                  points={entry.pointsSoFar}
                  palette={palette(entry.athlete.teamId)}
                  selected={addId === entry.athlete.id}
                  onClick={() => setAddId(entry.athlete.id)}
                />
              ))
            )}
          </div>
        )}

        {step === 3 && removed && added && (
          <div className="space-y-2 py-2 text-center text-sm">
            <p><strong>{removed.shortName}</strong> ({removed.position}) <span className="text-event-negative">↓ sai</span></p>
            <p className="text-muted-foreground">↓</p>
            <p><strong>{added.shortName}</strong> ({added.position}) <span className="text-event-positive">↑ entra</span></p>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button variant="outline" onClick={close} disabled={loading}>Cancelar</Button>
          ) : (
            <Button variant="outline" onClick={() => setStep((s) => (s === 3 ? 2 : 1))} disabled={loading}>← Voltar</Button>
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!removeId}>Próximo →</Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!addId}>Próximo →</Button>
          )}
          {step === 3 && (
            <Button onClick={() => removeId && addId && onConfirm(removeId, addId)} disabled={loading || !removeId || !addId}>
              {loading ? 'Confirmando...' : 'Confirmar substituição'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold',
            n < step ? 'bg-event-positive/20 text-event-positive' : n === step ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
          )}
        >
          {n < step ? '✓' : n}
        </span>
      ))}
    </span>
  )
}

function Row({
  label,
  position,
  points,
  palette,
  selected,
  onClick,
}: {
  label: string
  position: string
  points: number
  palette: Palette
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 p-2 rounded bg-surface hover:bg-accent text-left',
        selected && 'ring-2 ring-primary',
      )}
    >
      <span className="px-1.5 py-0.5 text-[0.6rem] font-semibold rounded bg-secondary text-muted-foreground uppercase">{position}</span>
      <JerseyIcon primaryColor={palette.primary} secondaryColor={palette.secondary} size="sm" />
      <span className="flex-1 text-sm font-medium truncate">{label}</span>
      <span className="tabular-nums text-sm text-muted-foreground">{points.toFixed(1)}</span>
    </button>
  )
}
