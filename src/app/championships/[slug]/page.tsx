'use client'

import Link from 'next/link'
import { use } from 'react'
import { useCurrentRound } from '@/hooks/useCatalog'
import { MatchCard } from '@/components/MatchCard'

export default function ChampionshipPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const { data, isLoading, isError } = useCurrentRound(slug)

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Campeonatos
      </Link>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {isError && (
        <p className="text-event-negative text-sm mt-4">
          Não foi possível carregar a rodada.
        </p>
      )}

      {data && (
        <>
          <header className="mt-4 mb-6">
            <h1 className="text-3xl font-bold text-foreground">{data.championship.name}</h1>
            <p className="text-muted-foreground mt-1">{data.round.name}</p>
          </header>

          {(() => {
            const upcoming = data.matches.filter(
              (m) => m.status !== 'finished' && m.status !== 'postponed' && m.status !== 'canceled',
            )
            return upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sem partidas disponíveis nesta rodada.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            )
          })()}
        </>
      )}
    </main>
  )
}
