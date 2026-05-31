import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LiveMatchView } from './live-match-view'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

const mutateAsync = vi.fn()
vi.mock('@/hooks/useMakeSubstitution', () => ({
  useMakeSubstitution: () => ({ mutateAsync, isPending: false, reset: vi.fn() }),
  SubstitutionError: class SubstitutionError extends Error {
    code = 'UNKNOWN'
  },
}))
vi.mock('@/hooks/useLiveSocket', () => ({ useLiveSocket: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const HOME_TEAM = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'Flamengo',
  shortName: 'FLA',
  abbreviation: 'FLA',
  imageUrl: null,
  primaryColor: '#FF0000',
  secondaryColor: '#FFFFFF',
}
const AWAY_TEAM = {
  id: '00000000-0000-4000-8000-000000000021',
  name: 'Palmeiras',
  shortName: 'PAL',
  abbreviation: 'PAL',
  imageUrl: null,
  primaryColor: '#008000',
  secondaryColor: '#FFFFFF',
}

function makeRoom(
  overrides: Partial<RoomSnapshotDto> = {},
  liveOverrides: Partial<NonNullable<RoomSnapshotDto['live']>> = {},
): RoomSnapshotDto {
  const base: RoomSnapshotDto = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'ABCDEF',
    status: 'live',
    match: {
      id: '00000000-0000-4000-8000-000000000030',
      kickoffAt: '2026-06-11T19:00:00.000Z',
      status: 'live',
      homeTeam: HOME_TEAM,
      awayTeam: AWAY_TEAM,
    },
    host: { id: 'host-id', nickname: 'hostnick' },
    guest: { id: 'guest-id', nickname: 'guestnick' },
    winner: null,
    expiresAt: '2026-06-11T22:00:00.000Z',
    createdAt: '2026-06-11T18:30:00.000Z',
    draft: null,
    live: {
      matchStatus: 'live',
      currentMinute: 30,
      currentMinuteAt: new Date().toISOString(),
      homeScore: 1,
      awayScore: 0,
      hostScore: 8,
      guestScore: 5,
      winner: null,
      hostLineup: [],
      guestLineup: [],
      recentEvents: [],
      pool: [],
      ...liveOverrides,
    },
  }
  return { ...base, ...overrides }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('LiveMatchView', () => {
  beforeEach(() => mutateAsync.mockReset())

  it('renders header + scoreboard + timeline for live state', () => {
    render(<LiveMatchView room={makeRoom()} isHost />, { wrapper })
    expect(screen.getAllByText('FLA').length).toBeGreaterThan(0)
    expect(screen.getAllByText('PAL').length).toBeGreaterThan(0)
    expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument()
    expect(screen.getByText(/Aguardando eventos/i)).toBeInTheDocument()
  })

  it('renders FinishedBanner when finished prop is true and winner is set', () => {
    const finishedRoom = makeRoom(
      { status: 'finished' },
      { matchStatus: 'finished', winner: 'host' },
    )
    render(<LiveMatchView room={finishedRoom} isHost finished />, { wrapper })
    expect(screen.getByText(/Você venceu/i)).toBeInTheDocument()
  })

  it('opens the substitution modal when "Substituir" is clicked', async () => {
    const user = userEvent.setup()
    render(<LiveMatchView room={makeRoom()} isHost />, { wrapper })

    const subButton = screen.getByRole('button', { name: /substituir/i })
    await user.click(subButton)
    expect(screen.getByText(/Substituir jogador/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })

  it('walks through the 3-step modal and calls the substitution mutation', async () => {
    mutateAsync.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const room = makeRoom(
      {},
      {
        hostLineup: [
          {
            athlete: {
              id: '00000000-0000-4000-8000-0000000000a1',
              name: 'Leo Pereira',
              shortName: 'Leo',
              position: 'ZAG',
              jerseyNumber: 4,
              teamId: HOME_TEAM.id,
            },
            cumulativePoints: 8,
          },
        ],
        pool: [
          {
            athlete: {
              id: '00000000-0000-4000-8000-0000000000b2',
              name: 'Murilo',
              shortName: 'Murilo',
              position: 'ZAG',
              jerseyNumber: 3,
              teamId: HOME_TEAM.id,
            },
            teamSide: 'home',
            pointsSoFar: 5,
          },
        ],
      },
    )
    render(<LiveMatchView room={room} isHost />, { wrapper })

    await user.click(screen.getByRole('button', { name: /substituir/i }))
    const modal = within(screen.getByText(/Substituir jogador/i).closest('[data-slot="dialog-content"]') as HTMLElement)
    // step 1: pick who leaves
    await user.click(modal.getByText('Leo'))
    await user.click(modal.getByRole('button', { name: /próximo/i }))
    // step 2: pick who enters
    await user.click(modal.getByText('Murilo'))
    await user.click(modal.getByRole('button', { name: /próximo/i }))
    // step 3: confirm
    await user.click(modal.getByRole('button', { name: /confirmar substituição/i }))

    expect(mutateAsync).toHaveBeenCalledWith({
      removeAthleteId: '00000000-0000-4000-8000-0000000000a1',
      addAthleteId: '00000000-0000-4000-8000-0000000000b2',
    })
  })

  it('hides sub button when finished', () => {
    const finishedRoom = makeRoom(
      { status: 'finished' },
      { matchStatus: 'finished', winner: 'guest' },
    )
    render(<LiveMatchView room={finishedRoom} isHost finished />, { wrapper })
    expect(screen.queryByRole('button', { name: /substituir/i })).not.toBeInTheDocument()
  })

  it('renders FinishedBanner using room.winner when live is null (abandoned WAITING/DRAFTING)', () => {
    const abandonedRoom: RoomSnapshotDto = {
      ...makeRoom({ status: 'finished', winner: 'abandoned' }),
      live: null,
    }
    render(<LiveMatchView room={abandonedRoom} isHost finished />, { wrapper })
    expect(screen.getByText(/Sala abandonada/i)).toBeInTheDocument()
    expect(screen.queryByText(/Carregando estado da partida/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/AO VIVO/i)).not.toBeInTheDocument()
  })

  it('renders "Você cancelou a sala" when host abandoned solo (no guest)', () => {
    const soloHostRoom: RoomSnapshotDto = {
      ...makeRoom({ status: 'finished', winner: 'abandoned' }),
      guest: null,
      live: null,
    }
    render(<LiveMatchView room={soloHostRoom} isHost finished />, { wrapper })
    expect(screen.getByText(/Você cancelou a sala/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Sala abandonada$/i)).not.toBeInTheDocument()
  })

  it('renders opponent nickname (not the role label) in the defeat banner', () => {
    const finishedRoom = makeRoom(
      { status: 'finished' },
      { matchStatus: 'finished', winner: 'guest' },
    )
    render(<LiveMatchView room={finishedRoom} isHost finished />, { wrapper })
    expect(screen.getByText(/guestnick venceu/i)).toBeInTheDocument()
    expect(screen.queryByText(/Guest venceu/i)).not.toBeInTheDocument()
  })
})
