import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLogout, useRequestMagicLink, useVerifyMagicLink } from './useAuth'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useRequestMagicLink', () => {
  it('POSTs the email to /auth/magic-link', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    const { result } = renderHook(() => useRequestMagicLink(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ email: 'user@example.com' })
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/auth/magic-link')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'user@example.com' })
  })
})

describe('useVerifyMagicLink', () => {
  it('POSTs the token, returns the user, and sets the [me] query data', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.c', nickname: 'a' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const setSpy = vi.spyOn(client, 'setQueryData')

    const wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useVerifyMagicLink(), { wrapper: wrap })

    let user: unknown
    await act(async () => {
      user = await result.current.mutateAsync({ token: 'a'.repeat(43) })
    })

    expect(user).toEqual({ id: 'u1', email: 'a@b.c', nickname: 'a' })
    expect(setSpy).toHaveBeenCalledWith(['me'], { id: 'u1', email: 'a@b.c', nickname: 'a' })
  })
})

describe('useLogout', () => {
  it('POSTs /auth/logout and clears the query cache', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['me'], { id: 'u1', email: 'a@b.c', nickname: 'a' })

    const wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useLogout(), { wrapper: wrap })

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/logout')
    await waitFor(() => {
      expect(client.getQueryData(['me'])).toBeUndefined()
    })
  })
})
