import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, type ReactNode } from 'react'
import ChampionshipPage from './page'
import { api } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } }
})

function team(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000020',
    name: 'A', shortName: 'A', abbreviation: 'AAA',
    imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
    position: 1, form: [],
    ...overrides,
  }
}

const CHAMPIONSHIP = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'brasileirao',
  name: 'Brasileirão',
  kind: 'league',
}

function currentRound() {
  return {
    championship: CHAMPIONSHIP,
    round: {
      id: '00000000-0000-4000-8000-000000000002',
      number: 1, name: 'Rodada 1', startsAt: null, endsAt: null,
    },
    matches: [
      {
        id: '00000000-0000-4000-8000-0000000000a1',
        championshipId: CHAMPIONSHIP.id,
        kickoffAt: '2026-05-31T15:00:00.000Z',
        status: 'scheduled',
        homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
        venue: 'Arena',
        homeTeam: team({ name: 'Corinthians', shortName: 'Corinthians', abbreviation: 'COR' }),
        awayTeam: team({ id: '00000000-0000-4000-8000-000000000021', name: 'São Paulo', shortName: 'São Paulo', abbreviation: 'SAO' }),
      },
      {
        id: '00000000-0000-4000-8000-0000000000a2',
        championshipId: CHAMPIONSHIP.id,
        kickoffAt: '2026-05-30T15:00:00.000Z',
        status: 'finished',
        homeScore: 2, awayScore: 1, currentMinute: null, lineupsConfirmedAt: null,
        venue: null,
        homeTeam: team({ id: '00000000-0000-4000-8000-000000000022', name: 'Flamengo', shortName: 'Flamengo', abbreviation: 'FLA' }),
        awayTeam: team({ id: '00000000-0000-4000-8000-000000000023', name: 'Palmeiras', shortName: 'Palmeiras', abbreviation: 'PAL' }),
      },
    ],
  }
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{ui}</Suspense>
    </QueryClientProvider>,
  )
}

describe('/championships/[slug]', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  it('renders finished matches (no longer filtered out)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(currentRound())
    await act(async () => {
      wrap(<ChampionshipPage params={Promise.resolve({ slug: 'brasileirao' })} />)
    })

    await waitFor(() => expect(screen.getByText('COR')).toBeInTheDocument())
    // The finished match used to be filtered from the listing — it must now show.
    expect(screen.getByText('FLA')).toBeInTheDocument()
    expect(screen.getByText('PAL')).toBeInTheDocument()
    expect(screen.getByText(/encerrado/i)).toBeInTheDocument()
  })

  it('groups matches under a date heading per day', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(currentRound())
    await act(async () => {
      wrap(<ChampionshipPage params={Promise.resolve({ slug: 'brasileirao' })} />)
    })

    await waitFor(() => expect(screen.getByText('COR')).toBeInTheDocument())
    // Two distinct kickoff days → two day-group headings.
    const dayHeadings = screen.getAllByRole('heading', { level: 2 })
    expect(dayHeadings).toHaveLength(2)
    expect(dayHeadings.map((h) => h.textContent)).toEqual([
      expect.stringMatching(/30 de maio$/),
      expect.stringMatching(/31 de maio$/),
    ])
  })
})
