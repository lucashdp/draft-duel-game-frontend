import { cn } from '@/lib/utils'
import type { Role } from '@/lib/contracts/rooms'

interface Props {
  lineupReady: boolean
  currentRole: Role | null
  myRole: Role
  currentPickNumber: number
  opponentNickname: string
}

export function TurnBanner({ lineupReady, currentRole, myRole, currentPickNumber, opponentNickname }: Props) {
  let text: string
  let tone: 'wait' | 'me' | 'them' | 'done' = 'wait'

  if (!lineupReady) {
    text = 'Aguardando escalação confirmada da partida…'
    tone = 'wait'
  } else if (currentRole === null) {
    text = 'Draft concluído. Aguardando início da partida…'
    tone = 'done'
  } else if (currentRole === myRole) {
    text = `Sua vez — pick ${currentPickNumber + 1}/10`
    tone = 'me'
  } else {
    text = `Vez de @${opponentNickname} — pick ${currentPickNumber + 1}/10`
    tone = 'them'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-lg border px-4 py-3 text-sm font-medium',
        tone === 'me' && 'border-primary bg-primary/10 text-primary',
        tone === 'them' && 'border-muted bg-muted/30 text-muted-foreground',
        tone === 'wait' && 'border-muted bg-muted/20 text-muted-foreground',
        tone === 'done' && 'border-event-positive/40 bg-event-positive/10 text-event-positive',
      )}
    >
      {text}
    </div>
  )
}
