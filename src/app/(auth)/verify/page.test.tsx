import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replaceMock = vi.fn()
let searchParamsValue = '?token=' + 'a'.repeat(43)

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsValue),
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}))

import VerifyPage from './page'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  replaceMock.mockReset()
  localStorage.clear()
  searchParamsValue = '?token=' + 'a'.repeat(43)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('VerifyPage', () => {
  it('consumes the token and redirects to / on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.c', nickname: 'a' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(wrap(<VerifyPage />))

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: 'a'.repeat(43) })
  })

  it('redirects to the stored from path on success', async () => {
    localStorage.setItem('dd_auth_from', '/championships/copa-2026')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.c', nickname: 'a' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(wrap(<VerifyPage />))

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/championships/copa-2026'))
    expect(localStorage.getItem('dd_auth_from')).toBeNull()
  })

  it('shows error state when the token is rejected', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Invalid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(wrap(<VerifyPage />))

    await waitFor(() => {
      expect(screen.getByText(/inválido ou expirado/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /solicitar novo/i })).toHaveAttribute('href', '/login')
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows error state when the URL has no token', async () => {
    searchParamsValue = ''
    render(wrap(<VerifyPage />))

    expect(screen.getByText(/inválido ou expirado/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
