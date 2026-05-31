'use client'

import Link from 'next/link'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useChampionships, useMatch, useMatchLineups } from '@/hooks/useCatalog'
import { MatchCard } from '@/components/MatchCard'
import { LineupGrid } from '@/components/LineupGrid'
import { MatchEventsTimeline } from '@/components/MatchEventsTimeline'
import { Button } from '@/components/ui/button'
import { useCreateRoom } from '@/hooks/useCreateRoom'
import { useAuth } from '@/hooks/useAuth'
import { useMatchEvents } from '@/hooks/useMatchEvents'
import { useMyRooms } from '@/hooks/useMyRooms'
import { getLoginPath } from '@/lib/auth'
import { findActiveRoomForMatch } from '@/lib/activeRoom'
import { MatchStatus } from '@/lib/contracts/rooms'

function getCreateRoomButtonLabel({
  isPending,
  isAuthed,
}: {
  isPending: boolean
  isAuthed: boolean
}): string {
  if (isPending) return 'Criando sala…'
  if (!isAuthed) return 'Fazer login pra criar sala'
  return 'Criar sala'
}

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const match = useMatch(id)
  const lineups = useMatchLineups(id)
  const championships = useChampionships()
  const router = useRouter()
  const { user } = useAuth()
  const createRoom = useCreateRoom()

  const isPlayedOrLive =
    match.data?.status === 'live' ||
    match.data?.status === 'finished' ||
    (match.data?.status === 'scheduled' && match.data?.homeScore !== null && match.data?.awayScore !== null)

  const events = useMatchEvents(id, Boolean(match.data) && Boolean(isPlayedOrLive))

  const myRooms = useMyRooms('active', { enabled: Boolean(user) })
  const activeRoom = match.data ? findActiveRoomForMatch(myRooms.data?.active, match.data.id) : null

  function handleCreateRoom() {
    if (!match.data) return
    if (!user) {
      router.push(getLoginPath(`/matches/${match.data.id}`))
      return
    }
    createRoom.mutate(
      { matchId: match.data.id },
      {
        onSuccess: (snapshot) => router.push(`/rooms/${snapshot.id}`),
      },
    )
  }

  const championship = match.data
    ? championships.data?.find((c) => c.id === match.data.championshipId)
    : undefined
  const backHref = championship ? `/championships/${championship.slug}` : '/'
  const backLabel = championship ? championship.name : 'Campeonatos'

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
        ← {backLabel}
      </Link>

      {match.isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {match.isError && (
        <p className="text-event-negative text-sm mt-4">
          Não foi possível carregar a partida.
        </p>
      )}

      {match.data && (
        <>
          <div className="mt-4 mb-6">
            <MatchCard match={match.data} />
            {activeRoom ? (
              <Button
                type="button"
                className="mt-4 w-full"
                onClick={() => router.push(`/rooms/${activeRoom.id}`)}
              >
                Voltar para a sala
              </Button>
            ) : (
              match.data.status !== MatchStatus.FINISHED && (
                <Button
                  type="button"
                  className="mt-4 w-full"
                  onClick={handleCreateRoom}
                  disabled={createRoom.isPending}
                >
                  {createRoom.isPending && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  {getCreateRoomButtonLabel({
                    isPending: createRoom.isPending,
                    isAuthed: Boolean(user),
                  })}
                </Button>
              )
            )}
          </div>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {isPlayedOrLive ? 'Eventos da Partida' : 'Jogadores Disponíveis'}
            </h2>
            {isPlayedOrLive ? (
              events.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : events.isError ? (
                <p className="text-sm text-event-negative">Não foi possível carregar os eventos.</p>
              ) : (
                <MatchEventsTimeline events={events.data ?? []} />
              )
            ) : (
              <>
                {lineups.isLoading && (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                )}
                {lineups.isError && (
                  <p className="text-sm text-event-negative">
                    Não foi possível carregar as escalações.
                  </p>
                )}
                {lineups.data && (
                  <LineupGrid
                    lineups={lineups.data}
                    homeTeam={match.data.homeTeam}
                    awayTeam={match.data.awayTeam}
                  />
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}
