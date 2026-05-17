'use client'

import Link from 'next/link'
import { use } from 'react'
import { useMatch, useMatchLineups } from '@/hooks/useCatalog'
import { MatchCard } from '@/components/MatchCard'
import { LineupGrid } from '@/components/LineupGrid'

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const match = useMatch(id)
  const lineups = useMatchLineups(id)

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Campeonatos
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
          </div>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Escalações
            </h2>
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
          </section>
        </>
      )}
    </main>
  )
}
