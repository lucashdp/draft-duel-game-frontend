'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useRoomPreview } from '@/hooks/useRoomPreview'
import { useJoinRoom } from '@/hooks/useJoinRoom'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { RoomErrorCode, RoomStatus } from '@/lib/contracts/rooms'
import { getLoginPath } from '@/lib/auth'

export default function RoomJoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
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

  if (preview.data.status !== RoomStatus.WAITING) {
    return (
      <main className="container mx-auto max-w-md px-4 py-12 text-center space-y-2">
        <h1 className="text-xl font-medium">Essa sala já está em andamento.</h1>
        <p className="text-sm text-muted-foreground">
          O anfitrião já recebeu um oponente.
        </p>
      </main>
    )
  }

  const joinError = join.error
  const joinErrorCode =
    joinError instanceof ApiError
      ? ((joinError as ApiError & { code?: string }).code ?? null)
      : null

  return (
    <main className="container mx-auto max-w-md px-4 py-12 space-y-6">
      <header className="text-center space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Você foi convidado
        </p>
        <h1 className="text-2xl font-semibold">
          {preview.data.host.nickname} chamou você pro Draft Duel
        </h1>
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

      {joinErrorCode === RoomErrorCode.IS_HOST && (
        <p className="text-sm text-event-negative text-center">
          Você é o anfitrião dessa sala.
        </p>
      )}
      {joinErrorCode === RoomErrorCode.ROOM_NOT_OPEN && (
        <p className="text-sm text-event-negative text-center">
          Essa sala já está em andamento.
        </p>
      )}
      {joinErrorCode === RoomErrorCode.ROOM_EXPIRED && (
        <p className="text-sm text-event-negative text-center">
          Esse link já expirou.
        </p>
      )}

      <Button
        type="button"
        className="w-full"
        onClick={handleJoin}
        disabled={join.isPending}
      >
        {join.isPending ? 'Entrando…' : user ? 'Entrar na sala' : 'Fazer login pra entrar'}
      </Button>
    </main>
  )
}
