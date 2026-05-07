import { env } from '@/lib/env'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions extends RequestInit {
  _skipRefresh?: boolean
}

async function executeRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(res.status, (body as { message?: string }).message ?? res.statusText)
  }

  return body as T
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  try {
    return await executeRequest<T>(path, init)
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      !init?._skipRefresh &&
      !path.startsWith('/auth/')
    ) {
      await executeRequest<void>('/auth/refresh', {
        method: 'POST',
        _skipRefresh: true,
      })
      return executeRequest<T>(path, init)
    }
    throw err
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
