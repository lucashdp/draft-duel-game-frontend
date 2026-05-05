export default async function ChampionshipPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold capitalize">{slug.replace(/-/g, ' ')}</h1>
      <p className="text-muted-foreground mt-2">Rodada atual · Partidas</p>
    </main>
  )
}
