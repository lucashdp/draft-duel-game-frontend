import { env } from '@/lib/env'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions extends RequestInit {
  _skipRefresh?: boolean
}

async function executeRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errBody = body as { message?: string; code?: string }
    throw new ApiError(res.status, errBody.message ?? res.statusText, errBody.code)
  }

  return body as T
}

let inflightRefresh: Promise<void> | null = null

function refreshOnce(): Promise<void> {
  if (!inflightRefresh) {
    inflightRefresh = executeRequest<void>('/auth/refresh', {
      method: 'POST',
      _skipRefresh: true,
    }).finally(() => {
      inflightRefresh = null
    })
  }
  return inflightRefresh
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
      await refreshOnce()
      return executeRequest<T>(path, init)
    }
    throw err
  }
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path),

  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  patch: <T = unknown>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
}
