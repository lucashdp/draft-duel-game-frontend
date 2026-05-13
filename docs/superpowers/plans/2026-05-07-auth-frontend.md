# Frontend Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the magic-link authentication flow on the frontend (login form, verify page, refresh-on-401, logout) so users can sign in and reach protected routes.

**Architecture:** TanStack Query mutations for the three auth actions (request/verify/logout) plus a transparent refresh-on-401 retry inside the existing `lib/api.ts` fetch wrapper. Cookies are httpOnly, set/cleared by the API — the frontend never touches them directly. A single in-flight refresh promise prevents duplicate rotations when multiple requests fail simultaneously.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TanStack Query v5 · Zod v4 · native `fetch` (no axios) · Vitest + Testing Library · Playwright.

**Out of scope (deferred):**
- Cross-tab auth sync (BroadcastChannel)
- Profile editing (PATCH /me)
- Multi-device session management UI
- Server-side rendering of authenticated pages (App Router pages stay client-rendered for the auth-gated tree)

---

## File Structure

**Modify:**
- `src/lib/api.ts` — add 401 → refresh → retry, single in-flight dedup, deny-list for `/auth/*` paths
- `src/hooks/useAuth.ts` — add `useRequestMagicLink`, `useVerifyMagicLink`, `useLogout` mutations
- `src/app/(auth)/login/page.tsx` — replace stub with email form
- `src/app/(auth)/verify/page.tsx` — replace stub with token-consume logic
- `src/app/(app)/layout.tsx` — capture `?from=` via existing `getLoginPath` helper
- `src/app/(app)/me/page.tsx` — add logout button

**Create:**
- `src/lib/api.test.ts` — refresh logic unit tests
- `src/hooks/useAuth.test.tsx` — mutation unit tests
- `src/app/(auth)/login/page.test.tsx` — form component test
- `src/app/(auth)/verify/page.test.tsx` — verify component test
- `test/e2e/auth-flow.spec.ts` — Playwright happy-path

**No new dependencies.**

---

## Conventions

- Test files colocated as `<name>.test.ts(x)`. Vitest picks them up via globals (`describe`, `it`, `expect`, `vi`).
- All API calls go through `lib/api.ts` (`api.get`, `api.post`, etc.).
- All auth state derives from the `['me']` TanStack Query — invalidate it to refresh, clear it to log out.
- Run unit tests: `npm test` (vitest run mode). Watch: `npm run test:watch`.
- Run e2e: `npm run test:e2e`.
- Commit cadence: one commit per task.

---

## Task 1: Refactor `request()` to support optional retry hook

**Files:**
- Modify: `src/lib/api.ts`

The current `request()` function is a single-shot fetch. To add refresh-on-401 we need to be able to retry the same call once. This task is a pure refactor — no new behavior — so the existing `useAuth` (which calls `api.get('/me').catch(() => null)`) keeps working.

- [ ] **Step 1: Read the current `lib/api.ts` to confirm baseline**

Run: `cat src/lib/api.ts`

Expected: Single `request<T>` function, `api` object with `get/post/patch/delete`, `ApiError` class.

- [ ] **Step 2: Extract the fetch+parse into `executeRequest`, with `request` as the public entry**

Replace the body of `lib/api.ts` (keep `ApiError` and the `api` object exports unchanged):

```typescript
import { env } from './env'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
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
  return executeRequest<T>(path, init)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run lint && npm test`

Expected: clean (no tests yet for api.ts; existing tests still pass).

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "refactor(api): extract executeRequest, add _skipRefresh option type"
```

---

## Task 2: Refresh-on-401 happy path

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/lib/api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api.test.ts`

Expected: FAIL — currently throws `ApiError(401)` instead of retrying.

- [ ] **Step 3: Implement the refresh-on-401 wrapper**

Replace the `request()` function in `src/lib/api.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(api): retry once with /auth/refresh after 401"
```

---

## Task 3: Refresh failure surfaces original 401

**Files:**
- Modify: `src/lib/api.test.ts` (add test)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/api.test.ts`:

```typescript
  it('throws original 401 when refresh itself fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' })) // /me
      .mockResolvedValueOnce(jsonResponse(401, {}))                      // /auth/refresh

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
```

- [ ] **Step 2: Run test**

Run: `npm test -- src/lib/api.test.ts`

Expected: PASS — the deny-list (`!path.startsWith('/auth/')`) and `_skipRefresh` flag implemented in Task 2 already cover these cases. If any test fails, the implementation in Task 2 is wrong; fix it.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.test.ts
git commit -m "test(api): refresh failure surfaces original 401, no recursion on auth paths"
```

---

## Task 4: Single in-flight refresh dedup

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/api.test.ts` (add test)

When two requests get 401 simultaneously (e.g. `/me` and `/championships` in parallel), they both currently call `/auth/refresh`. The second refresh would consume the rotated cookie set by the first, breaking the session. We dedupe so all callers share one in-flight refresh promise.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/api.test.ts`:

```typescript
  it('shares a single refresh promise across concurrent 401s', async () => {
    let refreshCallCount = 0
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++
        return emptyResponse(204)
      }
      if (url.includes('/me')) {
        return jsonResponse(200, { id: 'u1' })
      }
      if (url.includes('/championships')) {
        return jsonResponse(200, [{ id: 'c1' }])
      }
      return jsonResponse(404, {})
    })

    // First call to each path returns 401, then refresh succeeds, then retry.
    // Override: first call to /me and /championships → 401.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api.test.ts`

Expected: FAIL — `refreshCallCount` is 2 because each 401 triggers its own refresh.

- [ ] **Step 3: Implement single in-flight refresh promise**

Modify `src/lib/api.ts`. Add module-scoped state and update `request()`:

```typescript
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
```

- [ ] **Step 4: Run test**

Run: `npm test -- src/lib/api.test.ts`

Expected: PASS — all four api.test.ts tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(api): dedupe concurrent /auth/refresh calls via single in-flight promise"
```

---

## Task 5: `useRequestMagicLink` mutation hook

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Create: `src/hooks/useAuth.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAuth.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRequestMagicLink } from './useAuth'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useAuth.test.tsx`

Expected: FAIL — `useRequestMagicLink` is not exported.

- [ ] **Step 3: Implement the hook**

Append to `src/hooks/useAuth.ts`:

```typescript
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (input: { email: string }) => api.post<void>('/auth/magic-link', input),
  })
}
```

(Make sure `useMutation` import is added at the top of the file alongside the existing `useQuery`/`useQueryClient` imports.)

- [ ] **Step 4: Run test**

Run: `npm test -- src/hooks/useAuth.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/useAuth.test.tsx
git commit -m "feat(auth): useRequestMagicLink mutation hook"
```

---

## Task 6: `useVerifyMagicLink` mutation hook

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/hooks/useAuth.test.tsx` (add test)

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/useAuth.test.tsx`:

```typescript
import { useVerifyMagicLink } from './useAuth'

describe('useVerifyMagicLink', () => {
  it('POSTs the token, returns the user, and invalidates [me]', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.c', nickname: 'a' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useVerifyMagicLink(), { wrapper: wrap })

    let user: unknown
    await act(async () => {
      user = await result.current.mutateAsync({ token: 'a'.repeat(43) })
    })

    expect(user).toEqual({ id: 'u1', email: 'a@b.c', nickname: 'a' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me'] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useAuth.test.tsx`

Expected: FAIL — `useVerifyMagicLink` not exported.

- [ ] **Step 3: Implement the hook**

Append to `src/hooks/useAuth.ts`:

```typescript
import type { User } from '@/types/domain'

export function useVerifyMagicLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { token: string }) => {
      const res = await api.post<{ user: User }>('/auth/verify', input)
      return res.user
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
```

(If `User` is not exported from `@/types/domain`, look at the file and import the right name. The contract in the API returns `{ user: { id, email, nickname } }`.)

- [ ] **Step 4: Run test**

Run: `npm test -- src/hooks/useAuth.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/useAuth.test.tsx
git commit -m "feat(auth): useVerifyMagicLink mutation, invalidates [me] on success"
```

---

## Task 7: `useLogout` mutation hook

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/hooks/useAuth.test.tsx` (add test)

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/useAuth.test.tsx`:

```typescript
import { useLogout } from './useAuth'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useAuth.test.tsx`

Expected: FAIL — `useLogout` not exported.

- [ ] **Step 3: Implement the hook**

Append to `src/hooks/useAuth.ts`:

```typescript
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      queryClient.clear()
    },
  })
}
```

We use `onSettled` (not `onSuccess`) and `queryClient.clear()` so logout is idempotent: even if the API returns 401 (already logged out), the local cache is wiped.

- [ ] **Step 4: Run test**

Run: `npm test -- src/hooks/useAuth.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/useAuth.test.tsx
git commit -m "feat(auth): useLogout clears query cache on settle"
```

---

## Task 8: Login page form

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/page.test.tsx`

The page captures the optional `?from=` callback path on mount and stores it in `localStorage` under `dd_auth_from` (cleared after successful verify in Task 9). The form submits the email; success state shows "Confira seu email" regardless of API response.

- [ ] **Step 1: Write the failing test**

Create `src/app/(auth)/login/page.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
})
```

(`@testing-library/user-event` is not in `package.json` — install it if missing: `npm install --save-dev @testing-library/user-event`. If you prefer not to add a dep, replace `userEvent` with `fireEvent` from `@testing-library/react` and adjust calls.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/\\(auth\\)/login/page.test.tsx`

Expected: FAIL — current page is the stub with no form.

- [ ] **Step 3: Implement the page**

Replace `src/app/(auth)/login/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { useRequestMagicLink } from '@/hooks/useAuth'

const FROM_STORAGE_KEY = 'dd_auth_from'
const emailSchema = z.string().email()

export default function LoginPage() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const requestLink = useRequestMagicLink()

  useEffect(() => {
    const from = searchParams.get('from')
    if (from) {
      localStorage.setItem(FROM_STORAGE_KEY, from)
    }
  }, [searchParams])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setValidationError(null)
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setValidationError('Email inválido')
      return
    }
    requestLink.mutate(
      { email: parsed.data },
      {
        onSettled: () => setSubmitted(true),
      },
    )
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Confira seu email</h1>
        <p className="text-sm text-muted-foreground">
          Enviamos um link para <strong>{email}</strong>. O link expira em 15 minutos.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
        {validationError ? (
          <p className="mt-1 text-sm text-red-600">{validationError}</p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={requestLink.isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {requestLink.isPending ? 'Enviando…' : 'Enviar link'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- src/app/\\(auth\\)/login/page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx src/app/\(auth\)/login/page.test.tsx
git commit -m "feat(auth): login page form requests magic link, captures ?from="
```

---

## Task 9: Verify page consume logic

**Files:**
- Modify: `src/app/(auth)/verify/page.tsx`
- Create: `src/app/(auth)/verify/page.test.tsx`

The page reads `?token=` on mount, calls `useVerifyMagicLink`, and on success redirects to the stored `dd_auth_from` (or `/`). Errors show a message with a link back to `/login`.

- [ ] **Step 1: Write the failing test**

Create `src/app/(auth)/verify/page.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/\\(auth\\)/verify/page.test.tsx`

Expected: FAIL — current page is the stub.

- [ ] **Step 3: Implement the page**

Replace `src/app/(auth)/verify/page.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useVerifyMagicLink } from '@/hooks/useAuth'

const FROM_STORAGE_KEY = 'dd_auth_from'

type Status = 'pending' | 'error'

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const verify = useVerifyMagicLink()
  const [status, setStatus] = useState<Status>('pending')
  const submitted = useRef(false)

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true

    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      return
    }

    verify.mutate(
      { token },
      {
        onSuccess: () => {
          const from = localStorage.getItem(FROM_STORAGE_KEY)
          localStorage.removeItem(FROM_STORAGE_KEY)
          router.replace(from ?? '/')
        },
        onError: () => setStatus('error'),
      },
    )
  }, [searchParams, verify, router])

  if (status === 'error') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Solicite um novo link para entrar.
        </p>
        <Link href="/login" className="text-primary underline">
          Solicitar novo link
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">Verificando…</p>
    </div>
  )
}
```

The `submitted.current` ref guards against React 19 strict-mode double-invocation.

- [ ] **Step 4: Run test**

Run: `npm test -- src/app/\\(auth\\)/verify/page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/verify/page.tsx src/app/\(auth\)/verify/page.test.tsx
git commit -m "feat(auth): verify page consumes token, redirects to ?from or /"
```

---

## Task 10: Wire `?from=` capture in the auth guard

**Files:**
- Modify: `src/app/(app)/layout.tsx`

The current guard does `router.replace('/login')`. With Task 8 + 9 wired, we now want it to pass the current pathname so the user lands back where they were.

- [ ] **Step 1: Read the current layout to confirm baseline**

Run: `cat src/app/\(app\)/layout.tsx`

Expected: redirects to `/login` without `?from=`.

- [ ] **Step 2: Update the guard to use `getLoginPath`**

Replace the redirect logic in `src/app/(app)/layout.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getLoginPath } from '@/lib/auth'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(getLoginPath(pathname))
    }
  }, [user, isLoading, router, pathname])

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Carregando…</div>
  }

  if (!user) return null

  return <>{children}</>
}
```

- [ ] **Step 3: Manually verify in dev**

Run (in one terminal): `npm run dev`

Then in a browser, visit `http://localhost:3000/me` while logged out. The URL should redirect to `http://localhost:3000/login?from=%2Fme`. Stop the dev server.

If you can't open a browser, inspect the redirect manually with:

```bash
curl -sI http://localhost:3000/me
```

(Note: Next 15 client-side guards don't 302; this verification is best done via UI. Skip if no browser available and rely on Task 11's e2e.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "feat(auth): guard captures pathname into ?from= for post-login redirect"
```

---

## Task 11: Logout button on /me page

**Files:**
- Modify: `src/app/(app)/me/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat src/app/\(app\)/me/page.tsx`

Expected: scaffold page with placeholder content.

- [ ] **Step 2: Add the logout button**

Replace `src/app/(app)/me/page.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useAuth, useLogout } from '@/hooks/useAuth'

export default function MePage() {
  const { user } = useAuth()
  const logout = useLogout()
  const router = useRouter()

  function handleLogout() {
    logout.mutate(undefined, {
      onSettled: () => router.replace('/login'),
    })
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{user.nickname}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </header>
      <button
        onClick={handleLogout}
        disabled={logout.isPending}
        className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
      >
        {logout.isPending ? 'Saindo…' : 'Sair'}
      </button>
    </div>
  )
}
```

If `User` type doesn't have `nickname`, check `src/types/domain.ts` and use the actual fields. The API response from `/me` is `{ id, email, nickname }`.

- [ ] **Step 3: Run lint + tests**

Run: `npm run lint && npm test`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/me/page.tsx
git commit -m "feat(auth): logout button on /me page redirects to /login"
```

---

## Task 12: E2E happy-path test

**Files:**
- Create: `test/e2e/auth-flow.spec.ts`

This test mocks the API at the network level (`page.route`) since the frontend repo has no live backend in CI. It exercises: `/me` → guard redirect → login form submit → verify page consume → `/me` populated.

- [ ] **Step 1: Verify Playwright config exists**

Run: `cat playwright.config.ts`

Expected: a `webServer` block runs `npm run dev` and `baseURL` is `http://localhost:3000`. If not present, add one before continuing.

- [ ] **Step 2: Write the e2e test**

Create `test/e2e/auth-flow.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

const TOKEN = 'a'.repeat(43)
const USER = { id: 'u1', email: 'user@example.com', nickname: 'user' }

test('login → verify → me happy path', async ({ page }) => {
  let meCalls = 0
  let magicLinkBody: unknown

  await page.route('**/auth/magic-link', async (route) => {
    magicLinkBody = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ status: 204, body: '' })
  })

  await page.route('**/auth/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: USER }),
    })
  })

  await page.route('**/me', async (route) => {
    meCalls++
    if (meCalls === 1) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(USER),
    })
  })

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  // Hit a guarded route → guard redirects to /login?from=/me
  await page.goto('/me')
  await expect(page).toHaveURL(/\/login\?from=%2Fme$/)

  // Submit the email
  await page.getByLabel(/email/i).fill('user@example.com')
  await page.getByRole('button', { name: /enviar/i }).click()
  await expect(page.getByText(/confira seu email/i)).toBeVisible()
  expect(magicLinkBody).toEqual({ email: 'user@example.com' })

  // Simulate clicking the email link
  await page.goto(`/verify?token=${TOKEN}`)

  // Verify redirects to /me and the page renders user info
  await expect(page).toHaveURL('/me')
  await expect(page.getByText('user@example.com')).toBeVisible()
})
```

- [ ] **Step 3: Run the e2e test**

Run: `npm run test:e2e -- test/e2e/auth-flow.spec.ts`

Expected: PASS. If it fails, read the output carefully — common issues:
- `webServer` not configured → add to `playwright.config.ts`
- Test starts before dev server ready → increase `webServer.timeout`
- Selectors don't match → check the actual rendered text

- [ ] **Step 4: Commit**

```bash
git add test/e2e/auth-flow.spec.ts
git commit -m "test(auth): e2e happy path — guard, login, verify, /me"
```

---

## Final verification

After all 12 tasks complete:

- [ ] **Run full unit suite**

Run: `npm test`

Expected: all tests green.

- [ ] **Run full e2e suite**

Run: `npm run test:e2e`

Expected: all tests green.

- [ ] **Run lint**

Run: `npm run lint`

Expected: clean.

- [ ] **Build**

Run: `npm run build`

Expected: clean Next build, no type errors.

- [ ] **Manual sanity check (if local API is up)**

Start the API at `http://localhost:3001` (with the auth implementation merged or the `feat/auth-api` branch checked out). Then `npm run dev` on the frontend and walk the flow end-to-end:
1. Visit `/me` → redirected to `/login?from=%2Fme`
2. Enter email → see "Confira seu email"
3. Check email (or DB log if using stub provider) for the magic link
4. Click link → redirected to `/me` with profile loaded
5. Click "Sair" → redirected to `/login`

If any step fails, file a follow-up issue rather than patching in this branch.

---

## Self-Review Notes

- **Spec coverage:** All endpoints from §7.1 of `2026-05-01-draft-duel-rebuild-design.md` (`/auth/magic-link`, `/auth/verify`, `/auth/refresh`, `/auth/logout`, `GET /me`) are wired through TanStack Query mutations or the api client. `PATCH /me` is intentionally out of scope (profile editing is a future feature).
- **Refresh strategy:** Spec §9.1 step 4 says "Quando expirar: cliente chama POST /auth/refresh". Tasks 2-4 implement this transparently inside `lib/api.ts`.
- **Cookies:** The frontend never reads or writes cookies — they're httpOnly. `credentials: 'include'` (already in `lib/api.ts`) is the only required wiring. The cookie attributes from §3.1 of the network-evolution doc are the API's responsibility.
- **CORS:** Already wired in the API. Frontend just needs `credentials: 'include'` (present) and to call the absolute API URL (present via `env.NEXT_PUBLIC_API_URL`).
- **Storage key (`dd_auth_from`):** Uses localStorage so opening the magic-link in a new tab still preserves the redirect target. Cleared after use to avoid stale callbacks.
- **No new deps assumed.** If `@testing-library/user-event` is not yet installed, Task 8 calls it out as an option to install or to fall back to `fireEvent`.
- **Type consistency:** `User` is consistently imported from `@/types/domain` across all tasks. The verify mutation returns `User` (unwrapped from `{ user }`).
