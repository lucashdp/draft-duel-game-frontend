import { Trophy } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { RoomWinner, Role } from '@/lib/contracts/rooms'
import { cn } from '@/lib/utils'

interface FinishedBannerProps {
  winner: RoomWinner
  myRole: Role
}

export function FinishedBanner({ winner, myRole }: FinishedBannerProps) {
  let text = ''
  let positive = false

  if (winner === 'draw') {
    text = 'Empate!'
  } else if (winner === 'abandoned') {
    text = 'Sala abandonada'
  } else if (winner === myRole) {
    text = 'Você venceu!'
    positive = true
  } else {
    text = `${winner === 'host' ? 'Host' : 'Guest'} venceu`
  }

  return (
    <div className="bg-surface rounded-lg p-4 text-center border border-border">
      <Trophy
        size={32}
        className={cn(
          'mx-auto mb-2',
          positive ? 'text-event-positive' : 'text-muted-foreground',
        )}
      />
      <div className="text-lg font-bold">{text}</div>
      <Link href="/me">
        <Button className="mt-3" size="sm">
          Voltar pro perfil
        </Button>
      </Link>
    </div>
  )
}
