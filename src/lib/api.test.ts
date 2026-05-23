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

  it('surfaces a 401 ApiError when refresh itself fails (no retry)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, {}))

    await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not refresh when the failing request is /auth/refresh itself', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}))

    await expect(api.post('/auth/refresh')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when the failing request is under /auth/', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}))

    await expect(api.post('/auth/verify', { token: 'x'.repeat(43) })).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('omits Content-Type when POST has no body (Fastify rejects empty body + json header)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    await api.post('/rooms/ABC123/join')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('keeps Content-Type when POST has a body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    await api.post('/rooms', { matchId: 'm-1' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ matchId: 'm-1' }))
  })

  it('shares a single refresh promise across concurrent 401s', async () => {
    let refreshCallCount = 0
    let meCalls = 0
    let champCalls = 0
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++
        // Small delay to allow both retriers to enqueue.
        await new Promise((r) => setTimeout(r, 10))
        return emptyResponse(204)
      }
      if (url.includes('/me')) {
        meCalls++
        if (meCalls === 1) return jsonResponse(401, {})
        return jsonResponse(200, { id: 'u1' })
      }
      if (url.includes('/championships')) {
        champCalls++
        if (champCalls === 1) return jsonResponse(401, {})
        return jsonResponse(200, [{ id: 'c1' }])
      }
      return jsonResponse(404, {})
    })

    const [me, champs] = await Promise.all([
      api.get<{ id: string }>('/me'),
      api.get<Array<{ id: string }>>('/championships'),
    ])

    expect(me).toEqual({ id: 'u1' })
    expect(champs).toEqual([{ id: 'c1' }])
    expect(refreshCallCount).toBe(1)
  })
})
