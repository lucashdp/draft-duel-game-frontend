'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAbandonRoom } from '@/hooks/useAbandonRoom'

interface Props {
  roomId: string
  showAbandon: boolean
}

export function RoomActions({ roomId, showAbandon }: Props) {
  const router = useRouter()
  const abandon = useAbandonRoom()
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    abandon.mutate(
      { roomId },
      {
        onSuccess: () => {
          setOpen(false)
          router.push('/me')
        },
      },
    )
  }

  if (!showAbandon) return null

  return (
    <div className="pt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          Abandonar sala
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abandonar essa sala?</DialogTitle>
            <DialogDescription>
              Você não poderá voltar pra ela depois. Se ela ainda estiver aguardando, será cancelada;
              se já tiver oponente, a vitória vai pro outro jogador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={abandon.isPending} />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={abandon.isPending}
            >
              {abandon.isPending ? 'Abandonando…' : 'Abandonar sala'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
