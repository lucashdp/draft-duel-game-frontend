'use client'

import { ChampionshipCard } from '@/components/ChampionshipCard'
import { useChampionships } from '@/hooks/useCatalog'

export default function HomePage() {
  const { data, isLoading, isError } = useChampionships()

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Draft Duel</h1>
        <p className="text-muted-foreground mt-1">Escolha um campeonato pra começar.</p>
      </header>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {isError && (
        <p className="text-event-negative text-sm">
          Não foi possível carregar os campeonatos. Tente novamente em instantes.
        </p>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((c) => (
            <ChampionshipCard key={c.id} slug={c.slug} name={c.name} kind={c.kind} />
          ))}
        </div>
      )}
    </main>
  )
}
