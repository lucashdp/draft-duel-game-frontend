import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { LobbyView } from './lobby-view'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function wrap(ui: ReactNode) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const room = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'K7M2QH',
  status: 'waiting' as const,
  match: {
    id: '00000000-0000-4000-8000-000000000010',
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled' as const,
    homeTeam: { id: 'th', name: 'Flamengo', shortName: 'Flamengo', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { id: 'ta', name: 'Palmeiras', shortName: 'Palmeiras', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { id: '00000000-0000-4000-8000-0000000000a0', nickname: 'alice' },
  guest: null,
  winner: null,
  expiresAt: '2026-05-18T20:00:00.000Z',
  createdAt: '2026-05-17T10:00:00.000Z',
  draft: null,
  live: null,
}

describe('LobbyView', () => {
  it('shows the invite link, opponent skeleton, and match summary', () => {
    wrap(<LobbyView room={room} isHost />)
    expect(screen.getByText('Flamengo')).toBeInTheDocument()
    expect(screen.getByText('Palmeiras')).toBeInTheDocument()
    expect(screen.getByText(/aguardando oponente/i)).toBeInTheDocument()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('K7M2QH')
    expect(screen.getByRole('button', { name: /abandonar sala/i })).toBeInTheDocument()
  })

  it('does not show invite link or abandon button for non-hosts', () => {
    wrap(<LobbyView room={room} isHost={false} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /abandonar sala/i })).not.toBeInTheDocument()
  })
})
