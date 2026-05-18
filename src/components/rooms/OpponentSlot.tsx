import { cn } from '@/lib/utils'

interface Props {
  opponent: { nickname: string } | null
}

export function OpponentSlot({ opponent }: Props) {
  if (!opponent) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3">
        <div className={cn('h-3 w-3 rounded-full bg-muted-foreground/40 animate-pulse')} />
        <span className="text-sm text-muted-foreground">Aguardando oponente…</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
      <div className="h-3 w-3 rounded-full bg-event-positive" />
      <span className="text-sm font-medium">{opponent.nickname}</span>
    </div>
  )
}
