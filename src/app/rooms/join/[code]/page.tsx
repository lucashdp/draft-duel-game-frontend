'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useRoomPreview } from '@/hooks/useRoomPreview'
import { useJoinRoom } from '@/hooks/useJoinRoom'
import { useAuth, useInvalidateAuth } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { RoomStatus } from '@/lib/contracts/rooms'
import { formatJoinError } from '@/lib/format-room'
import { getLoginPath } from '@/lib/auth'

function getJoinButtonLabel({
  isPending,
  isAuthed,
  isWaiting,
}: {
  isPending: boolean
  isAuthed: boolean
  isWaiting: boolean
}): string {
  if (isPending) return 'Entrando…'
  if (!isAuthed) return isWaiting ? 'Fazer login pra entrar' : 'Fazer login pra voltar'
  return isWaiting ? 'Entrar na sala' : 'Voltar pra sala'
}

export default function RoomJoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const invalidateAuth = useInvalidateAuth()
  const preview = useRoomPreview(code)
  const join = useJoinRoom()

  function handleJoin() {
    if (!user) {
      router.push(getLoginPath(`/rooms/join/${code}`))
      return
    }
    join.mutate(
      { code },
      {
        onSuccess: (snapshot) => router.push(`/rooms/${snapshot.id}`),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 401) {
            invalidateAuth()
            router.push(getLoginPath(`/rooms/join/${code}`))
          }
        },
      },
    )
  }

  if (authLoading || preview.isLoading) {
    return (
      <main className="container mx-auto max-w-md px-4 py-12">
        <div className="flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    )
  }

  if (preview.isError) {
    const status = preview.error instanceof ApiError ? preview.error.status : 0
    const msg =
      status === 404
        ? 'Sala não encontrada.'
        : status === 410
          ? 'Esse link de sala já expirou.'
          : 'Não foi possível carregar o convite.'
    return (
      <main className="container mx-auto max-w-md px-4 py-12">
        <p className="text-event-negative text-sm">{msg}</p>
      </main>
    )
  }

  if (!preview.data) return null

  const isWaiting = preview.data.status === RoomStatus.WAITING

  return (
    <main className="container mx-auto max-w-md px-4 py-12 space-y-6">
      <header className="text-center space-y-2">
        {isWaiting ? (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Você foi convidado
            </p>
            <h1 className="text-2xl font-semibold">
              {preview.data.host.nickname} chamou você pro Draft Duel
            </h1>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Essa sala já começou
            </p>
            <h1 className="text-2xl font-semibold">
              Se você é um dos jogadores, entre pra continuar
            </h1>
          </>
        )}
      </header>

      <div className="rounded-lg border bg-surface p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {new Date(preview.data.match.kickoffAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="text-lg font-medium">
          {preview.data.match.homeTeam.name} × {preview.data.match.awayTeam.name}
        </p>
      </div>

      {join.isError && (
        <p role="alert" className="text-sm text-event-negative text-center">
          {formatJoinError(join.error)}
        </p>
      )}

      <Button
        type="button"
        className="w-full"
        onClick={handleJoin}
        disabled={join.isPending}
      >
        {join.isPending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {getJoinButtonLabel({ isPending: join.isPending, isAuthed: Boolean(user), isWaiting })}
      </Button>
    </main>
  )
}
