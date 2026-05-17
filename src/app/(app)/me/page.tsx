'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { useMyRooms } from '@/hooks/useMyRooms'
import { Separator } from '@/components/ui/separator'
import type { RoomSummaryDto } from '@/lib/contracts/rooms'

export default function MePage() {
  const { user } = useAuth()
  const logout = useLogout()
  const router = useRouter()

  function handleLogout() {
    // Navigate only after the server has cleared the session cookie (and the
    // query cache has been dropped in the mutation's onSettled). On failure we
    // still leave — onSettled fires on error too — but at least we tried.
    logout.mutate(undefined, {
      onSettled: () => router.replace('/login'),
    })
  }

  if (!user) return null

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">{user.nickname}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </header>
        <MyRoomsSection />
        <Separator />
        <button
          onClick={handleLogout}
          disabled={logout.isPending}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          {logout.isPending ? 'Saindo…' : 'Sair'}
        </button>
      </div>
    </main>
  )
}

function MyRoomsSection() {
  const my = useMyRooms()

  if (my.isLoading) return null
  if (!my.data) return null

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Minhas salas
      </h2>

      {my.data.active.length === 0 && my.data.finished.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem salas. Crie uma na página de uma partida.
        </p>
      )}

      {my.data.active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Ativas</p>
          <ul className="space-y-2">
            {my.data.active.map((room) => (
              <RoomLink key={room.id} room={room} />
            ))}
          </ul>
        </div>
      )}

      {my.data.finished.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Finalizadas</p>
          <ul className="space-y-2">
            {my.data.finished.map((room) => (
              <RoomLink key={room.id} room={room} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function RoomLink({ room }: { room: RoomSummaryDto }) {
  return (
    <li>
      <Link
        href={`/rooms/${room.id}`}
        className="block rounded-md border bg-surface px-3 py-2 hover:border-primary"
      >
        <p className="text-sm font-medium">
          {room.match.homeTeam.name} × {room.match.awayTeam.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {room.role === 'host' ? 'Anfitrião' : 'Convidado'} ·{' '}
          {room.opponent?.nickname ?? '—'} · {room.status}
        </p>
      </Link>
    </li>
  )
}
