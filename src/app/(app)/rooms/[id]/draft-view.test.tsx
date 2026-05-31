import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { DraftView } from './draft-view'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

const mutate = vi.fn()
vi.mock('@/hooks/useMakePick', () => ({
  useMakePick: () => ({ mutate, isPending: false, reset: vi.fn() }),
  PickError: class PickError extends Error { code = 'UNKNOWN' },
}))
vi.mock('@/hooks/useDraftSocket', () => ({ useDraftSocket: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/rooms/RoomActions', () => ({
  RoomActions: () => null,
}))

const ATH_HOME = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'PedroHome', shortName: 'PedroHome',
  position: 'GOL' as const, jerseyNumber: 1,
  teamId: '00000000-0000-4000-8000-000000000020',
}

function makeRoom(overrides: Partial<RoomSnapshotDto> = {}, draftOverrides: Partial<NonNullable<RoomSnapshotDto['draft']>> = {}): RoomSnapshotDto {
  const base: RoomSnapshotDto = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'ABCDEF',
    status: 'drafting',
    match: {
      id: '00000000-0000-4000-8000-000000000030',
      kickoffAt: '2026-06-11T19:00:00.000Z',
      status: 'scheduled',
      homeTeam: { id: '00000000-0000-4000-8000-000000000020', name: 'Home', shortName: 'HOM', abbreviation: 'HOM', imageUrl: null, primaryColor: '#FF0000', secondaryColor: '#FFFFFF' },
      awayTeam: { id: 'ta', name: 'Away', shortName: 'AWY', abbreviation: 'AWY', imageUrl: null, primaryColor: '#0000FF', secondaryColor: '#FFFFFF' },
    },
    host: { id: 'host-id', nickname: 'hostnick' },
    guest: { id: 'guest-id', nickname: 'guestnick' },
    winner: null,
    expiresAt: '2026-06-11T22:00:00.000Z',
    createdAt: '2026-06-11T18:30:00.000Z',
    draft: {
      currentPickNumber: 0,
      currentRole: 'host',
      lineupReady: true,
      picks: [],
      pool: [{ athlete: ATH_HOME, teamSide: 'home', pickedByRole: null }],
      ...draftOverrides,
    },
    live: null,
  }
  return { ...base, ...overrides }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('DraftView', () => {
  beforeEach(() => mutate.mockReset())

  it('renders "Sua vez" when host views and currentRole=host', () => {
    render(<DraftView room={makeRoom()} isHost={true} />, { wrapper })
    expect(screen.getByText(/sua vez/i)).toBeInTheDocument()
  })

  it('disables pool when not my turn', () => {
    render(<DraftView room={makeRoom({}, { currentRole: 'guest' })} isHost={true} />, { wrapper })
    expect(screen.getByText(/vez de.*guestnick/i)).toBeInTheDocument()
  })

  it('shows "Aguardando escalação" CTA when lineupReady=false', () => {
    render(<DraftView room={makeRoom({}, { lineupReady: false })} isHost={true} />, { wrapper })
    expect(screen.getByRole('button', { name: /atualizar escala/i })).toBeInTheDocument()
  })

  it('opens dialog and calls mutate on confirm', async () => {
    const user = userEvent.setup()
    render(<DraftView room={makeRoom()} isHost={true} />, { wrapper })
    await user.click(screen.getByText('PedroHome'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^confirmar$/i }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ pickNumber: 0, athleteId: ATH_HOME.id }),
      expect.any(Object),
    )
  })
})
