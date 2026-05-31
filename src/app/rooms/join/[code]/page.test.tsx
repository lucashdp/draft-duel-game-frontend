import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, type ReactNode } from 'react'
import RoomJoinPage from './page'
import { api, ApiError } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } }
})

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const userMock = { id: 'u-guest' }
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: userMock, isLoading: false }),
  useInvalidateAuth: () => () => {},
}))

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{ui}</Suspense>
    </QueryClientProvider>,
  )
}

const preview = {
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { name: 'Flamengo', shortName: 'F', abbreviation: 'FLA', imageUrl: null, primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { name: 'Palmeiras', shortName: 'P', abbreviation: 'PAL', imageUrl: null, primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { nickname: 'alice' },
  expiresAt: '2026-05-18T20:00:00.000Z',
}

describe('/rooms/join/[code]', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    push.mockReset()
  })

  it('renders preview with host nickname and team names', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(preview)
    await act(async () => {
      wrap(<RoomJoinPage params={Promise.resolve({ code: 'K7M2QH' })} />)
    })
    await waitFor(() => expect(screen.getByText(/alice/i)).toBeInTheDocument())
    expect(screen.getByText(/Flamengo/i)).toBeInTheDocument()
    expect(screen.getByText(/Palmeiras/i)).toBeInTheDocument()
  })

  it('shows a generic error message when join fails with an unknown error', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValueOnce(preview)
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError(500, 'boom'))
    await act(async () => {
      wrap(<RoomJoinPage params={Promise.resolve({ code: 'K7M2QH' })} />)
    })
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível entrar/i),
    )
  })

  it('redirects to /login with from on 401 from join', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValueOnce(preview)
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError(401, 'unauthorized'))
    await act(async () => {
      wrap(<RoomJoinPage params={Promise.resolve({ code: 'K7M2QH' })} />)
    })
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/login?from=%2Frooms%2Fjoin%2FK7M2QH'),
    )
  })

  it('joins and navigates to /rooms/<id> on click', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValueOnce(preview)
    vi.mocked(api.post).mockResolvedValueOnce({
      id: '00000000-0000-4000-8000-000000000001',
      code: 'K7M2QH',
      status: 'drafting',
      match: { ...preview.match, id: '00000000-0000-4000-8000-000000000010', homeTeam: { ...preview.match.homeTeam, id: 'h', imageUrl: null }, awayTeam: { ...preview.match.awayTeam, id: 'a', imageUrl: null } },
      host: { id: '00000000-0000-4000-8000-0000000000a0', nickname: 'alice' },
      guest: { id: '00000000-0000-4000-8000-0000000000b0', nickname: 'bob' },
      winner: null,
      expiresAt: preview.expiresAt,
      createdAt: '2026-05-17T10:00:00.000Z',
      draft: null,
      live: null,
    })
    await act(async () => {
      wrap(<RoomJoinPage params={Promise.resolve({ code: 'K7M2QH' })} />)
    })
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/rooms/00000000-0000-4000-8000-000000000001'))
  })
})
