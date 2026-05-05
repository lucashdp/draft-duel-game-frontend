export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Partida</h1>
      <p className="text-muted-foreground mt-2 text-sm font-mono">{id}</p>
    </main>
  )
}
