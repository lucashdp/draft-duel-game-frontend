'use client'

import { useRouter } from 'next/navigation'
import { useAuth, useLogout } from '@/hooks/useAuth'

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
