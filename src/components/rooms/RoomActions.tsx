'use client'

import { Button } from '@/components/ui/button'
import { useAbandonRoom } from '@/hooks/useAbandonRoom'
import { useRouter } from 'next/navigation'

interface Props {
  roomId: string
  showAbandon: boolean
}

export function RoomActions({ roomId, showAbandon }: Props) {
  const router = useRouter()
  const abandon = useAbandonRoom()

  function handleAbandon() {
    if (!confirm('Tem certeza que quer abandonar essa sala?')) return
    abandon.mutate(
      { roomId },
      {
        onSuccess: () => router.push('/me'),
      },
    )
  }

  if (!showAbandon) return null

  return (
    <div className="pt-4">
      <Button type="button" variant="ghost" onClick={handleAbandon} disabled={abandon.isPending}>
        {abandon.isPending ? 'Abandonando…' : 'Abandonar sala'}
      </Button>
    </div>
  )
}
