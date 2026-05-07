import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './api'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function emptyResponse(status: number) {
  return new Response(null, { status })
}

describe('api refresh-on-401', () => {
  it('retries the original request after a successful refresh', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' })) // /me #1
      .mockResolvedValueOnce(emptyResponse(204))                         // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { id: 'u1', email: 'a@b.c', nickname: 'a' })) // /me retry

    const result = await api.get<{ id: string }>('/me')

    expect(result).toEqual({ id: 'u1', email: 'a@b.c', nickname: 'a' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh')
  })
})
