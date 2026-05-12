import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FROM_STORAGE_KEY } from '@/lib/auth'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}))

import LoginPage from './page'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('LoginPage', () => {
  it('submits email and shows the success state', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const user = userEvent.setup()

    render(wrap(<LoginPage />))

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/confira seu email/i)).toBeInTheDocument()
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'user@example.com' })
  })

  it('rejects malformed email client-side', async () => {
    const user = userEvent.setup()
    render(wrap(<LoginPage />))

    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    expect(screen.getByText(/email inválido/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears a stale stored from path when visited without ?from', async () => {
    localStorage.setItem(FROM_STORAGE_KEY, '/me')

    render(wrap(<LoginPage />))

    await waitFor(() => expect(localStorage.getItem(FROM_STORAGE_KEY)).toBeNull())
  })
})
