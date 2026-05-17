# Room Creation Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the lobby UX on top of the Rooms API and Socket.IO gateway — a host creates a room from `/matches/[id]`, gets a shareable invite link (`/rooms/join/<code>`), a guest opens the link, sees a preview, confirms, and lands in `/rooms/<id>`. The host's lobby view updates in real time when the guest joins.

**Architecture:** Five wire contracts (Zod) replicated from the API spec live in `src/lib/contracts/rooms.ts` + `src/lib/contracts/ws.ts`. Seven hooks (TanStack Query mutations/queries + a Socket.IO sync hook) front the API. Four pure components (`InviteLinkCard`, `OpponentSlot`, `MatchSummary`, `RoomActions`) compose into two views (`LobbyView`, `PendingView`) under `/rooms/[id]`. The Socket.IO singleton in `src/lib/socket.ts` is expanded with typed `emit`/`on` helpers; `useRoomSocket` joins the `room:<id>` channel, listens to `room:guest_joined` and `room:abandoned`, and writes fresh snapshots back into TanStack via `setQueryData`.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TanStack Query v5 · Socket.IO client v4 · Zod v4 · Tailwind v4 + shadcn/ui · Vitest + Testing Library · Playwright.

**Spec:** [`docs/superpowers/specs/2026-05-17-room-creation-design.md`](../specs/2026-05-17-room-creation-design.md)

**Out of scope (deferred):**
- Snake draft UI (vertical 4): `DraftBoard`, snake pick mechanics
- Live match (vertical 5): `MatchScoreboard`, `MatchTimeline`, `SubstitutionDialog`
- Profile stats history (vertical 6)
- Pacote `@draft-duel/contracts` formal (continues copy-paste)

---

## File Structure

**Modify:**
- `src/lib/socket.ts` — add typed emit/on helpers
- `src/hooks/useRoom.ts` — replace stub with real implementation
- `src/app/(app)/rooms/[id]/page.tsx` — replace stub with status dispatcher
- `src/app/matches/[id]/page.tsx` — add "Criar sala" CTA
- `src/app/(app)/me/page.tsx` — add "Minhas salas" section
- `README.md` — document the new routes/hooks

**Create — contracts:**
- `src/lib/contracts/rooms.ts`
- `src/lib/contracts/ws.ts`
- `src/lib/contracts/rooms.test.ts`

**Create — constants:**
- `src/constants/rooms.ts`

**Create — hooks:**
- `src/hooks/useRoomPreview.ts` + `useRoomPreview.test.tsx`
- `src/hooks/useCreateRoom.ts` + `useCreateRoom.test.tsx`
- `src/hooks/useJoinRoom.ts` + `useJoinRoom.test.tsx`
- `src/hooks/useAbandonRoom.ts` + `useAbandonRoom.test.tsx`
- `src/hooks/useMyRooms.ts` + `useMyRooms.test.tsx`
- `src/hooks/useRoomSocket.ts` + `useRoomSocket.test.tsx`
- `src/hooks/useRoom.test.tsx` (alongside the rewritten `useRoom.ts`)

**Create — components:**
- `src/components/rooms/InviteLinkCard.tsx` + `.test.tsx`
- `src/components/rooms/OpponentSlot.tsx` + `.test.tsx`
- `src/components/rooms/MatchSummary.tsx`
- `src/components/rooms/RoomActions.tsx`

**Create — routes:**
- `src/app/rooms/join/[code]/page.tsx` + `page.test.tsx`
- `src/app/(app)/rooms/[id]/lobby-view.tsx` + `.test.tsx`
- `src/app/(app)/rooms/[id]/pending-view.tsx`

**Create — E2E:**
- `test/e2e/room-creation.spec.ts`

**No new npm deps** (`socket.io-client` and Zod v4 already in `package.json`).

---

## Conventions

- Tests live alongside the source file as `<name>.test.{ts,tsx}`. E2E lives in `test/e2e/<feature>.spec.ts`.
- Hooks return TanStack Query result objects directly (`useQuery` / `useMutation`); pages destructure `.data`, `.isLoading`, `.error`, `.mutate`.
- Components are pure presentational where possible (data via props). Containers (route pages) wire hooks → components.
- Wire contracts: enum values are **lowercase** to match the existing project convention (`src/types/domain.ts` already uses `'host'|'guest'`, `'waiting'|'drafting'|'live'|'finished'`, etc.). The API mappers convert Prisma UPPERCASE → wire lowercase. Zod schemas mirror the API DTOs.
- `as const` objects for enums in `contracts/rooms.ts` and `contracts/ws.ts`; types derived via `typeof X[keyof typeof X]`.
- Run unit tests: `npm test`. E2E (starts dev server automatically): `npm run test:e2e`. Lint: `npm run lint`.
- Commit cadence: one commit per task. Conventional Commits style.

---

## Task 1: Rooms contracts (Zod schemas + enum constants)

**Files:**
- Create: `src/lib/contracts/rooms.ts`
- Create: `src/lib/contracts/rooms.test.ts`

Mirrors the API's DTOs in spec §4.1. Enum string values match exactly (UPPERCASE). Same Zod v4 pattern as `src/lib/contracts/catalog.ts`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/contracts/rooms.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  RoomStatus,
  Role,
  RoomWinner,
  RoomErrorCode,
  roomSnapshotSchema,
  roomPreviewSchema,
  myRoomsResponseSchema,
} from './rooms'

const validSnapshot = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: {
      id: 'th',
      name: 'Flamengo',
      shortName: 'Flamengo',
      abbreviation: 'FLA',
      primaryColor: '#FF0000',
      secondaryColor: '#000000',
    },
    awayTeam: {
      id: 'ta',
      name: 'Palmeiras',
      shortName: 'Palmeiras',
      abbreviation: 'PAL',
      primaryColor: '#006633',
      secondaryColor: '#FFFFFF',
    },
  },
  host: { id: 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', nickname: 'alice' },
  guest: null,
  winner: null,
  expiresAt: '2026-05-18T20:00:00.000Z',
  createdAt: '2026-05-17T10:00:00.000Z',
}

describe('rooms contracts', () => {
  it('exposes RoomStatus as const + type (lowercase wire values)', () => {
    expect(RoomStatus.WAITING).toBe('waiting')
    expect(RoomStatus.DRAFTING).toBe('drafting')
    expect(RoomStatus.LIVE).toBe('live')
    expect(RoomStatus.FINISHED).toBe('finished')
  })

  it('exposes Role and RoomWinner (lowercase wire values)', () => {
    expect(Role.HOST).toBe('host')
    expect(Role.GUEST).toBe('guest')
    expect(RoomWinner.HOST).toBe('host')
    expect(RoomWinner.DRAW).toBe('draw')
    expect(RoomWinner.ABANDONED).toBe('abandoned')
  })

  it('exposes RoomErrorCode matching API enum (UPPERCASE — these are error codes, not domain enums)', () => {
    expect(RoomErrorCode.MATCH_NOT_FOUND).toBe('MATCH_NOT_FOUND')
    expect(RoomErrorCode.MATCH_INELIGIBLE).toBe('MATCH_INELIGIBLE')
    expect(RoomErrorCode.ROOM_NOT_FOUND).toBe('ROOM_NOT_FOUND')
    expect(RoomErrorCode.ROOM_NOT_OPEN).toBe('ROOM_NOT_OPEN')
    expect(RoomErrorCode.ROOM_EXPIRED).toBe('ROOM_EXPIRED')
    expect(RoomErrorCode.IS_HOST).toBe('IS_HOST')
    expect(RoomErrorCode.RACE_LOST).toBe('RACE_LOST')
    expect(RoomErrorCode.NOT_MEMBER).toBe('NOT_MEMBER')
  })

  it('roomSnapshotSchema parses a valid waiting room', () => {
    const parsed = roomSnapshotSchema.parse(validSnapshot)
    expect(parsed.status).toBe('waiting')
    expect(parsed.guest).toBeNull()
  })

  it('roomSnapshotSchema rejects UPPERCASE status (must be wire-format)', () => {
    expect(() =>
      roomSnapshotSchema.parse({ ...validSnapshot, status: 'WAITING' }),
    ).toThrow()
  })

  it('roomPreviewSchema strips id/host.id', () => {
    const parsed = roomPreviewSchema.parse({
      code: 'K7M2QH',
      status: 'waiting',
      match: {
        kickoffAt: validSnapshot.match.kickoffAt,
        status: validSnapshot.match.status,
        homeTeam: {
          name: 'F',
          shortName: 'F',
          abbreviation: 'FLA',
          primaryColor: '#FF0000',
          secondaryColor: '#000000',
        },
        awayTeam: {
          name: 'P',
          shortName: 'P',
          abbreviation: 'PAL',
          primaryColor: '#006633',
          secondaryColor: '#FFFFFF',
        },
      },
      host: { nickname: 'alice' },
      expiresAt: validSnapshot.expiresAt,
    })
    expect(parsed.host).toEqual({ nickname: 'alice' })
  })

  it('myRoomsResponseSchema parses { active, finished }', () => {
    const parsed = myRoomsResponseSchema.parse({ active: [], finished: [] })
    expect(parsed.active).toEqual([])
    expect(parsed.finished).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rooms`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement contracts**

Create `src/lib/contracts/rooms.ts`:

```ts
import { z } from 'zod'

/** Wire format = lowercase (mirrors API's mapper output, matches src/types/domain.ts). */
export const RoomStatus = {
  WAITING: 'waiting',
  DRAFTING: 'drafting',
  LIVE: 'live',
  FINISHED: 'finished',
} as const
export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus]

export const Role = {
  HOST: 'host',
  GUEST: 'guest',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const RoomWinner = {
  HOST: 'host',
  GUEST: 'guest',
  DRAW: 'draw',
  ABANDONED: 'abandoned',
} as const
export type RoomWinner = (typeof RoomWinner)[keyof typeof RoomWinner]

export const MatchStatus = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
} as const
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus]

export const RoomErrorCode = {
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  MATCH_INELIGIBLE: 'MATCH_INELIGIBLE',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_NOT_OPEN: 'ROOM_NOT_OPEN',
  ROOM_EXPIRED: 'ROOM_EXPIRED',
  IS_HOST: 'IS_HOST',
  RACE_LOST: 'RACE_LOST',
  NOT_MEMBER: 'NOT_MEMBER',
} as const
export type RoomErrorCode = (typeof RoomErrorCode)[keyof typeof RoomErrorCode]

const teamRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
})
export type TeamRefDto = z.infer<typeof teamRefSchema>

const teamRefPublicSchema = teamRefSchema.omit({ id: true })
export type TeamRefPublicDto = z.infer<typeof teamRefPublicSchema>

const teamRefSummarySchema = z.object({
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
})
export type TeamRefSummaryDto = z.infer<typeof teamRefSummarySchema>

const userRefSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
})
export type UserRefDto = z.infer<typeof userRefSchema>

export const roomSnapshotSchema = z.object({
  id: z.string().uuid(),
  code: z.string().length(6),
  status: z.enum(Object.values(RoomStatus) as [string, ...string[]]),
  match: z.object({
    id: z.string().uuid(),
    kickoffAt: z.string(),
    status: z.enum(Object.values(MatchStatus) as [string, ...string[]]),
    homeTeam: teamRefSchema,
    awayTeam: teamRefSchema,
  }),
  host: userRefSchema,
  guest: userRefSchema.nullable(),
  winner: z.enum(Object.values(RoomWinner) as [string, ...string[]]).nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
})
export type RoomSnapshotDto = z.infer<typeof roomSnapshotSchema>

export const roomPreviewSchema = z.object({
  code: z.string().length(6),
  status: z.enum(Object.values(RoomStatus) as [string, ...string[]]),
  match: z.object({
    kickoffAt: z.string(),
    status: z.enum(Object.values(MatchStatus) as [string, ...string[]]),
    homeTeam: teamRefPublicSchema,
    awayTeam: teamRefPublicSchema,
  }),
  host: z.object({ nickname: z.string() }),
  expiresAt: z.string(),
})
export type RoomPreviewDto = z.infer<typeof roomPreviewSchema>

export const roomSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(Object.values(RoomStatus) as [string, ...string[]]),
  role: z.enum(Object.values(Role) as [string, ...string[]]),
  match: z.object({
    kickoffAt: z.string(),
    status: z.enum(Object.values(MatchStatus) as [string, ...string[]]),
    homeTeam: teamRefSummarySchema,
    awayTeam: teamRefSummarySchema,
  }),
  opponent: z.object({ nickname: z.string() }).nullable(),
  winner: z.enum(Object.values(RoomWinner) as [string, ...string[]]).nullable(),
  createdAt: z.string(),
})
export type RoomSummaryDto = z.infer<typeof roomSummarySchema>

export const myRoomsResponseSchema = z.object({
  active: z.array(roomSummarySchema),
  finished: z.array(roomSummarySchema),
})
export type MyRoomsResponseDto = z.infer<typeof myRoomsResponseSchema>

export const createRoomRequestSchema = z.object({
  matchId: z.string().uuid(),
})
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- rooms`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/rooms.ts src/lib/contracts/rooms.test.ts
git commit -m "feat(rooms): contracts — Zod schemas and enums replicated from API"
```

---

## Task 2: WS contracts (event names + error codes)

**Files:**
- Create: `src/lib/contracts/ws.ts`

Mirrors `src/modules/ws/enums/*` from the API. Lists all spec §7.2 events; only lobby ones are used in this vertical.

- [ ] **Step 1: Create the contracts**

```ts
export const WsClientEvent = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  DRAFT_PICK: 'draft:pick',
  MATCH_SUBSTITUTE: 'match:substitute',
} as const
export type WsClientEvent = (typeof WsClientEvent)[keyof typeof WsClientEvent]

export const WsServerEvent = {
  ROOM_STATE: 'room:state',
  ROOM_GUEST_JOINED: 'room:guest_joined',
  ROOM_ABANDONED: 'room:abandoned',
  DRAFT_PICK_MADE: 'draft:pick_made',
  DRAFT_CURRENT_PICK: 'draft:current_pick',
  MATCH_STARTED: 'match:started',
  MATCH_EVENT: 'match:event',
  MATCH_SCORE_UPDATED: 'match:score_updated',
  MATCH_SUBSTITUTION_APPLIED: 'match:substitution_applied',
  MATCH_FINISHED: 'match:finished',
  ERROR: 'error',
} as const
export type WsServerEvent = (typeof WsServerEvent)[keyof typeof WsServerEvent]

export const WsErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_MEMBER: 'NOT_MEMBER',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  VALIDATION: 'VALIDATION',
  INTERNAL: 'INTERNAL',
} as const
export type WsErrorCode = (typeof WsErrorCode)[keyof typeof WsErrorCode]

export interface RoomGuestJoinedPayload {
  guest: { id: string; nickname: string }
  status: string  // wire format: 'waiting' | 'drafting' | 'live' | 'finished'
}

export interface RoomAbandonedPayload {
  by: 'host' | 'guest'
  winner: 'host' | 'guest' | null
}

export interface WsErrorPayload {
  code: WsErrorCode
  message: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/ws.ts
git commit -m "feat(ws): contracts — event names, error codes, payload types"
```

---

## Task 3: Rooms constants (semantic helpers)

**Files:**
- Create: `src/constants/rooms.ts`

Centralizes magic strings/numbers used by hooks, components and routes.

- [ ] **Step 1: Implement**

```ts
import { env } from '@/lib/env'

/** Frontend route prefix for the public invite link. */
export const INVITE_PATH_PREFIX = '/rooms/join'

/** Build the full invite URL the host shares with the guest.
 *  Uses NEXT_PUBLIC_WEB_ORIGIN when available; falls back to window.location.origin at runtime.
 */
export function buildInviteUrl(code: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${INVITE_PATH_PREFIX}/${code}`
  }
  // SSR fallback — should rarely render server-side, but keeps types safe.
  return `${env.NEXT_PUBLIC_WEB_ORIGIN ?? ''}${INVITE_PATH_PREFIX}/${code}`
}

/** Refetch interval for safety on the lobby (in case WS missed a transition). */
export const LOBBY_REFETCH_MS = 60_000

/** TanStack stale time for room snapshots — short, but avoids refetch storms. */
export const ROOM_STALE_MS = 5_000
```

- [ ] **Step 2: Add `NEXT_PUBLIC_WEB_ORIGIN` to `src/lib/env.ts` schema (optional)**

Open `src/lib/env.ts`. If `NEXT_PUBLIC_WEB_ORIGIN` is not in the schema, add it as optional:

```ts
NEXT_PUBLIC_WEB_ORIGIN: z.string().url().optional(),
```

If you'd rather not surface a new env var, delete the SSR fallback in `buildInviteUrl` and accept that the invite link is only built on the client.

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/constants/rooms.ts src/lib/env.ts
git commit -m "feat(rooms): invite URL helper and lobby refetch constants"
```

---

## Task 4: Expand `src/lib/socket.ts` with typed helpers

**Files:**
- Modify: `src/lib/socket.ts`

Adds `socketEmit` / `socketOn` helpers that use the `WsClientEvent` / `WsServerEvent` enums. The connection lifecycle (`getSocket`, `connectSocket`, `disconnectSocket`) stays as-is — `useRoomSocket` will handle connect on mount.

- [ ] **Step 1: Replace `src/lib/socket.ts` with the expanded version**

```ts
import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'
import {
  type WsClientEvent,
  type WsServerEvent,
} from '@/lib/contracts/ws'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(env.NEXT_PUBLIC_WS_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket'],
    })
  }
  return socket
}

export function connectSocket(): void {
  getSocket().connect()
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/** Typed wrapper around socket.emit so handlers can be searched by enum value. */
export function socketEmit<T>(event: WsClientEvent, payload: T, ack?: (resp: unknown) => void): void {
  if (ack) {
    getSocket().emit(event, payload, ack)
  } else {
    getSocket().emit(event, payload)
  }
}

/** Subscribe to a server event. Returns an unsubscribe function. */
export function socketOn<T>(event: WsServerEvent, handler: (payload: T) => void): () => void {
  const sock = getSocket()
  sock.on(event, handler as (...args: unknown[]) => void)
  return () => {
    sock.off(event, handler as (...args: unknown[]) => void)
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/socket.ts
git commit -m "feat(socket): typed emit/on helpers using WS event enums"
```

---

## Task 5: `useRoom` hook (replace stub)

**Files:**
- Modify: `src/hooks/useRoom.ts`
- Create: `src/hooks/useRoom.test.tsx`

Real implementation: `useQuery(['room', roomId])` fetching `GET /rooms/:id`, validated through `roomSnapshotSchema`.

- [ ] **Step 1: Write failing test**

Create `src/hooks/useRoom.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRoom } from './useRoom'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const fakeRoom = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { id: 'th', name: 'F', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { id: 'ta', name: 'P', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { id: 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', nickname: 'alice' },
  guest: null,
  winner: null,
  expiresAt: '2026-05-18T20:00:00.000Z',
  createdAt: '2026-05-17T10:00:00.000Z',
}

describe('useRoom', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('fetches /rooms/:id and parses the response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(fakeRoom)
    const { result } = renderHook(() => useRoom(fakeRoom.id), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith(`/rooms/${fakeRoom.id}`)
    expect(result.current.data?.code).toBe('K7M2QH')
  })

  it('skips query when roomId is empty', () => {
    const { result } = renderHook(() => useRoom(''), { wrapper: wrapper() })
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useRoom`
Expected: FAIL — old stub returns `{ room: null }`, not the TanStack result.

- [ ] **Step 3: Replace `useRoom.ts`**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'
import { ROOM_STALE_MS } from '@/constants/rooms'

export function useRoom(roomId: string) {
  return useQuery<RoomSnapshotDto>({
    queryKey: ['room', roomId],
    queryFn: async () => roomSnapshotSchema.parse(await api.get(`/rooms/${roomId}`)),
    enabled: Boolean(roomId),
    staleTime: ROOM_STALE_MS,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useRoom`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRoom.ts src/hooks/useRoom.test.tsx
git commit -m "feat(rooms): useRoom hook (replaces stub)"
```

---

## Task 6: `useRoomPreview` hook

**Files:**
- Create: `src/hooks/useRoomPreview.ts`
- Create: `src/hooks/useRoomPreview.test.tsx`

Public `GET /rooms/by-code/:code/preview`. Used by the invite landing page.

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRoomPreview } from './useRoomPreview'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const fakePreview = {
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { name: 'F', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { name: 'P', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { nickname: 'alice' },
  expiresAt: '2026-05-18T20:00:00.000Z',
}

describe('useRoomPreview', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('fetches /rooms/by-code/:code/preview', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(fakePreview)
    const { result } = renderHook(() => useRoomPreview('K7M2QH'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith('/rooms/by-code/K7M2QH/preview')
    expect(result.current.data?.host.nickname).toBe('alice')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useRoomPreview`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomPreviewSchema, type RoomPreviewDto } from '@/lib/contracts/rooms'

export function useRoomPreview(code: string) {
  return useQuery<RoomPreviewDto>({
    queryKey: ['room-preview', code],
    queryFn: async () => roomPreviewSchema.parse(await api.get(`/rooms/by-code/${code}/preview`)),
    enabled: Boolean(code),
    retry: false,
  })
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- useRoomPreview`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRoomPreview.ts src/hooks/useRoomPreview.test.tsx
git commit -m "feat(rooms): useRoomPreview for public invite link page"
```

---

## Task 7: `useCreateRoom`, `useJoinRoom`, `useAbandonRoom` mutations

**Files:**
- Create: `src/hooks/useCreateRoom.ts` + `useCreateRoom.test.tsx`
- Create: `src/hooks/useJoinRoom.ts` + `useJoinRoom.test.tsx`
- Create: `src/hooks/useAbandonRoom.ts` + `useAbandonRoom.test.tsx`

Three mutations. Each invalidates relevant queries on success.

- [ ] **Step 1: Tests for `useCreateRoom`**

Create `src/hooks/useCreateRoom.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCreateRoom } from './useCreateRoom'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const fakeRoom = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { id: 'th', name: 'F', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { id: 'ta', name: 'P', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { id: 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', nickname: 'alice' },
  guest: null,
  winner: null,
  expiresAt: '2026-05-18T20:00:00.000Z',
  createdAt: '2026-05-17T10:00:00.000Z',
}

describe('useCreateRoom', () => {
  beforeEach(() => vi.mocked(api.post).mockReset())

  it('POSTs /rooms with matchId and returns the snapshot', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(fakeRoom)
    const { result } = renderHook(() => useCreateRoom(), { wrapper: wrapper() })

    result.current.mutate({ matchId: fakeRoom.match.id })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.post).toHaveBeenCalledWith('/rooms', { matchId: fakeRoom.match.id })
    expect(result.current.data?.code).toBe('K7M2QH')
  })
})
```

- [ ] **Step 2: Implement `useCreateRoom`**

Create `src/hooks/useCreateRoom.ts`:

```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, { matchId: string }>({
    mutationFn: async (input) =>
      roomSnapshotSchema.parse(await api.post('/rooms', input)),
    onSuccess: (snapshot) => {
      qc.setQueryData(['room', snapshot.id], snapshot)
      qc.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
```

- [ ] **Step 3: Run `useCreateRoom` tests**

Run: `npm test -- useCreateRoom`
Expected: 1 test passes.

- [ ] **Step 4: Tests for `useJoinRoom`**

Create `src/hooks/useJoinRoom.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useJoinRoom } from './useJoinRoom'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useJoinRoom', () => {
  beforeEach(() => vi.mocked(api.post).mockReset())

  it('POSTs /rooms/:code/join and returns the snapshot', async () => {
    const fakeSnapshot = {
      id: '11111111-1111-1111-1111-111111111111',
      code: 'K7M2QH',
      status: 'drafting',
      match: {
        id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
        kickoffAt: '2026-05-18T18:00:00.000Z',
        status: 'scheduled',
        homeTeam: { id: 'th', name: 'F', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
        awayTeam: { id: 'ta', name: 'P', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
      },
      host: { id: 'h', nickname: 'alice' },
      guest: { id: 'g', nickname: 'bob' },
      winner: null,
      expiresAt: '2026-05-18T20:00:00.000Z',
      createdAt: '2026-05-17T10:00:00.000Z',
    }
    vi.mocked(api.post).mockResolvedValueOnce(fakeSnapshot)
    const { result } = renderHook(() => useJoinRoom(), { wrapper: wrapper() })
    result.current.mutate({ code: 'K7M2QH' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.post).toHaveBeenCalledWith('/rooms/K7M2QH/join')
    expect(result.current.data?.status).toBe('drafting')
  })
})
```

- [ ] **Step 5: Implement `useJoinRoom`**

```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useJoinRoom() {
  const qc = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, { code: string }>({
    mutationFn: async ({ code }) =>
      roomSnapshotSchema.parse(await api.post(`/rooms/${code}/join`)),
    onSuccess: (snapshot) => {
      qc.setQueryData(['room', snapshot.id], snapshot)
      qc.invalidateQueries({ queryKey: ['room-preview', snapshot.code] })
      qc.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
```

- [ ] **Step 6: Tests for `useAbandonRoom`**

Create `src/hooks/useAbandonRoom.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAbandonRoom } from './useAbandonRoom'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useAbandonRoom', () => {
  beforeEach(() => vi.mocked(api.post).mockReset())

  it('POSTs /rooms/:id/abandon', async () => {
    const fakeSnapshot = {
      id: '11111111-1111-1111-1111-111111111111',
      code: 'K7M2QH',
      status: 'finished',
      match: {
        id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
        kickoffAt: '2026-05-18T18:00:00.000Z',
        status: 'scheduled',
        homeTeam: { id: 'th', name: 'F', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
        awayTeam: { id: 'ta', name: 'P', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
      },
      host: { id: 'h', nickname: 'alice' },
      guest: null,
      winner: null,
      expiresAt: '2026-05-18T20:00:00.000Z',
      createdAt: '2026-05-17T10:00:00.000Z',
    }
    vi.mocked(api.post).mockResolvedValueOnce(fakeSnapshot)
    const { result } = renderHook(() => useAbandonRoom(), { wrapper: wrapper() })
    result.current.mutate({ roomId: fakeSnapshot.id })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.post).toHaveBeenCalledWith(`/rooms/${fakeSnapshot.id}/abandon`)
    expect(result.current.data?.status).toBe('finished')
  })
})
```

- [ ] **Step 7: Implement `useAbandonRoom`**

```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useAbandonRoom() {
  const qc = useQueryClient()
  return useMutation<RoomSnapshotDto, Error, { roomId: string }>({
    mutationFn: async ({ roomId }) =>
      roomSnapshotSchema.parse(await api.post(`/rooms/${roomId}/abandon`)),
    onSuccess: (snapshot) => {
      qc.setQueryData(['room', snapshot.id], snapshot)
      qc.invalidateQueries({ queryKey: ['me', 'rooms'] })
    },
  })
}
```

- [ ] **Step 8: Run all three hook tests**

Run: `npm test -- useCreateRoom useJoinRoom useAbandonRoom`
Expected: 3 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useCreateRoom.* src/hooks/useJoinRoom.* src/hooks/useAbandonRoom.*
git commit -m "feat(rooms): useCreateRoom, useJoinRoom, useAbandonRoom mutations"
```

---

## Task 8: `useMyRooms` hook

**Files:**
- Create: `src/hooks/useMyRooms.ts` + `useMyRooms.test.tsx`

`GET /me/rooms`. Used by the new section in `/me`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMyRooms } from './useMyRooms'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useMyRooms', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('fetches /me/rooms with no filter and parses the response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ active: [], finished: [] })
    const { result } = renderHook(() => useMyRooms(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith('/me/rooms')
    expect(result.current.data?.active).toEqual([])
  })

  it('passes ?status=active when filter provided', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ active: [], finished: [] })
    renderHook(() => useMyRooms('active'), { wrapper: wrapper() })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/me/rooms?status=active')
  })
})
```

- [ ] **Step 2: Implement**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { myRoomsResponseSchema, type MyRoomsResponseDto } from '@/lib/contracts/rooms'

export function useMyRooms(filter?: 'active' | 'finished') {
  const path = filter ? `/me/rooms?status=${filter}` : '/me/rooms'
  return useQuery<MyRoomsResponseDto>({
    queryKey: ['me', 'rooms', filter ?? 'all'],
    queryFn: async () => myRoomsResponseSchema.parse(await api.get(path)),
  })
}
```

- [ ] **Step 3: Run test**

Run: `npm test -- useMyRooms`
Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useMyRooms.*
git commit -m "feat(rooms): useMyRooms for /me listing"
```

---

## Task 9: `useRoomSocket` — the WS sync hook

**Files:**
- Create: `src/hooks/useRoomSocket.ts`
- Create: `src/hooks/useRoomSocket.test.tsx`

Most important client-side piece. On mount: connect socket, emit `room:join { roomId }`, subscribe to `room:state`, `room:guest_joined`, `room:abandoned`, `error`. On any room state event, write into `queryClient.setQueryData(['room', roomId], …)` so the existing `useRoom` query stays in sync. On unmount: emit `room:leave`, unsubscribe.

- [ ] **Step 1: Write failing test**

Create `src/hooks/useRoomSocket.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { EventEmitter } from 'node:events'
import { useRoomSocket } from './useRoomSocket'

const sockEvents = new EventEmitter()
const sock = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    sockEvents.on(event, handler)
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    sockEvents.off(event, handler)
  }),
  emit: vi.fn((event: string, payload: unknown, ack?: (resp: unknown) => void) => {
    if (event === 'room:join' && ack) {
      ack({ id: 'r-1', code: 'K7M2QH', status: 'waiting' })
    }
  }),
}

vi.mock('@/lib/socket', () => ({
  getSocket: () => sock,
  connectSocket: () => sock.connect(),
  disconnectSocket: () => sock.disconnect(),
  socketEmit: (event: string, payload: unknown, ack?: (r: unknown) => void) =>
    sock.emit(event, payload, ack),
  socketOn: (event: string, handler: (payload: unknown) => void) => {
    sock.on(event, handler as (...args: unknown[]) => void)
    return () => sock.off(event, handler as (...args: unknown[]) => void)
  },
}))

function wrapper() {
  const qc = new QueryClient()
  return {
    qc,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

describe('useRoomSocket', () => {
  beforeEach(() => {
    sock.connect.mockClear()
    sock.disconnect.mockClear()
    sock.emit.mockClear()
    sock.on.mockClear()
    sock.off.mockClear()
  })

  it('connects and emits room:join on mount, leaves on unmount', () => {
    const { Wrapper } = wrapper()
    const { unmount } = renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    expect(sock.connect).toHaveBeenCalled()
    expect(sock.emit).toHaveBeenCalledWith('room:join', { roomId: 'r-1' }, expect.any(Function))
    unmount()
    expect(sock.emit).toHaveBeenCalledWith('room:leave', { roomId: 'r-1' }, undefined)
    expect(sock.disconnect).toHaveBeenCalled()
  })

  it('updates the TanStack cache when room:guest_joined arrives', () => {
    const { qc, Wrapper } = wrapper()
    qc.setQueryData(['room', 'r-1'], { id: 'r-1', status: 'waiting', guest: null })
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    act(() => {
      sockEvents.emit('room:guest_joined', { guest: { id: 'g', nickname: 'bob' }, status: 'drafting' })
    })
    const cached = qc.getQueryData(['room', 'r-1']) as any
    expect(cached?.status).toBe('drafting')
    expect(cached?.guest).toEqual({ id: 'g', nickname: 'bob' })
  })

  it('updates the cache on room:abandoned', () => {
    const { qc, Wrapper } = wrapper()
    qc.setQueryData(['room', 'r-1'], { id: 'r-1', status: 'drafting', winner: null })
    renderHook(() => useRoomSocket('r-1'), { wrapper: Wrapper })
    act(() => {
      sockEvents.emit('room:abandoned', { by: 'host', winner: 'guest' })
    })
    const cached = qc.getQueryData(['room', 'r-1']) as any
    expect(cached?.status).toBe('finished')
    expect(cached?.winner).toBe('guest')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useRoomSocket`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  connectSocket,
  disconnectSocket,
  socketEmit,
  socketOn,
} from '@/lib/socket'
import {
  WsClientEvent,
  WsServerEvent,
  type RoomGuestJoinedPayload,
  type RoomAbandonedPayload,
} from '@/lib/contracts/ws'
import { roomSnapshotSchema, type RoomSnapshotDto } from '@/lib/contracts/rooms'

export function useRoomSocket(roomId: string): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (!roomId) return

    connectSocket()

    const handleState = (raw: unknown) => {
      const parsed = roomSnapshotSchema.safeParse(raw)
      if (parsed.success) {
        qc.setQueryData(['room', roomId], parsed.data)
      }
    }

    const handleGuestJoined = (payload: RoomGuestJoinedPayload) => {
      qc.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return { ...prev, status: payload.status as RoomSnapshotDto['status'], guest: payload.guest }
      })
    }

    const handleAbandoned = (payload: RoomAbandonedPayload) => {
      qc.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return { ...prev, status: 'finished', winner: payload.winner }
      })
    }

    const offState = socketOn<unknown>(WsServerEvent.ROOM_STATE, handleState)
    const offGuestJoined = socketOn<RoomGuestJoinedPayload>(
      WsServerEvent.ROOM_GUEST_JOINED,
      handleGuestJoined,
    )
    const offAbandoned = socketOn<RoomAbandonedPayload>(
      WsServerEvent.ROOM_ABANDONED,
      handleAbandoned,
    )

    socketEmit<{ roomId: string }>(WsClientEvent.ROOM_JOIN, { roomId }, (snapshot) => {
      handleState(snapshot)
    })

    return () => {
      offState()
      offGuestJoined()
      offAbandoned()
      socketEmit<{ roomId: string }>(WsClientEvent.ROOM_LEAVE, { roomId })
      disconnectSocket()
    }
  }, [qc, roomId])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useRoomSocket`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRoomSocket.ts src/hooks/useRoomSocket.test.tsx
git commit -m "feat(rooms): useRoomSocket — WS sync of room state into TanStack cache"
```

---

## Task 10: `InviteLinkCard` component

**Files:**
- Create: `src/components/rooms/InviteLinkCard.tsx`
- Create: `src/components/rooms/InviteLinkCard.test.tsx`

Shows `${origin}/rooms/join/<code>` in a readonly input with a copy button. Uses `sonner` for toast feedback.

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteLinkCard } from './InviteLinkCard'

const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })

describe('InviteLinkCard', () => {
  beforeEach(() => writeText.mockClear())

  it('renders the invite URL built from the code', () => {
    render(<InviteLinkCard code="K7M2QH" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toContain('/rooms/join/K7M2QH')
    expect(input.readOnly).toBe(true)
  })

  it('copies to clipboard on click', async () => {
    const user = userEvent.setup()
    render(<InviteLinkCard code="K7M2QH" />)
    await user.click(screen.getByRole('button', { name: /copiar/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/rooms/join/K7M2QH'))
  })
})
```

- [ ] **Step 2: Implement**

Create `src/components/rooms/InviteLinkCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { buildInviteUrl } from '@/constants/rooms'

interface Props {
  code: string
}

export function InviteLinkCard({ code }: Props) {
  const [url] = useState(() => buildInviteUrl(code))

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        Compartilhe este link
      </label>
      <div className="flex gap-2">
        <Input value={url} readOnly className="font-mono text-sm" />
        <Button type="button" onClick={handleCopy} variant="secondary">
          Copiar
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run test**

Run: `npm test -- InviteLinkCard`
Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/rooms/InviteLinkCard.tsx src/components/rooms/InviteLinkCard.test.tsx
git commit -m "feat(rooms): InviteLinkCard with copy-to-clipboard"
```

---

## Task 11: `OpponentSlot` component

**Files:**
- Create: `src/components/rooms/OpponentSlot.tsx`
- Create: `src/components/rooms/OpponentSlot.test.tsx`

Renders either a "waiting for opponent" pulsing skeleton or the guest nickname.

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OpponentSlot } from './OpponentSlot'

describe('OpponentSlot', () => {
  it('shows waiting state when opponent is null', () => {
    render(<OpponentSlot opponent={null} />)
    expect(screen.getByText(/aguardando oponente/i)).toBeInTheDocument()
  })

  it('shows opponent nickname when present', () => {
    render(<OpponentSlot opponent={{ nickname: 'bob' }} />)
    expect(screen.getByText('bob')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement**

```tsx
import { cn } from '@/lib/utils'

interface Props {
  opponent: { nickname: string } | null
}

export function OpponentSlot({ opponent }: Props) {
  if (!opponent) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3">
        <div className={cn('h-3 w-3 rounded-full bg-muted-foreground/40 animate-pulse')} />
        <span className="text-sm text-muted-foreground">Aguardando oponente…</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
      <div className="h-3 w-3 rounded-full bg-event-positive" />
      <span className="text-sm font-medium">{opponent.nickname}</span>
    </div>
  )
}
```

- [ ] **Step 3: Run test**

Run: `npm test -- OpponentSlot`
Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/rooms/OpponentSlot.tsx src/components/rooms/OpponentSlot.test.tsx
git commit -m "feat(rooms): OpponentSlot — waiting/joined states"
```

---

## Task 12: `MatchSummary` and `RoomActions` components

**Files:**
- Create: `src/components/rooms/MatchSummary.tsx`
- Create: `src/components/rooms/RoomActions.tsx`

Compact match card for the lobby and the "Abandonar sala" button. No tests for these — they're presentational wrappers covered indirectly by the lobby view tests.

- [ ] **Step 1: Implement `MatchSummary`**

```tsx
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

interface Props {
  match: RoomSnapshotDto['match']
}

export function MatchSummary({ match }: Props) {
  const date = new Date(match.kickoffAt)
  const formatted = date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="rounded-lg border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
        {formatted}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-base font-medium">{match.homeTeam.name}</span>
        <span className="text-sm text-muted-foreground">vs</span>
        <span className="text-base font-medium">{match.awayTeam.name}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `RoomActions`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { useAbandonRoom } from '@/hooks/useAbandonRoom'
import { useRouter } from 'next/navigation'

interface Props {
  roomId: string
  showAbandon: boolean
}

export function RoomActions({ roomId, showAbandon }: Props) {
  const router = useRouter()
  const abandon = useAbandonRoom()

  function handleAbandon() {
    if (!confirm('Tem certeza que quer abandonar essa sala?')) return
    abandon.mutate(
      { roomId },
      {
        onSuccess: () => router.push('/me'),
      },
    )
  }

  if (!showAbandon) return null

  return (
    <div className="pt-4">
      <Button type="button" variant="ghost" onClick={handleAbandon} disabled={abandon.isPending}>
        {abandon.isPending ? 'Abandonando…' : 'Abandonar sala'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/rooms/MatchSummary.tsx src/components/rooms/RoomActions.tsx
git commit -m "feat(rooms): MatchSummary and RoomActions presentational components"
```

---

## Task 13: `LobbyView` + `PendingView` for `/rooms/[id]`

**Files:**
- Modify: `src/app/(app)/rooms/[id]/page.tsx`
- Create: `src/app/(app)/rooms/[id]/lobby-view.tsx`
- Create: `src/app/(app)/rooms/[id]/lobby-view.test.tsx`
- Create: `src/app/(app)/rooms/[id]/pending-view.tsx`

Page is the dispatcher: based on `status`, render `LobbyView` (WAITING) or `PendingView` (anything else for now).

- [ ] **Step 1: Implement `PendingView`**

Create `src/app/(app)/rooms/[id]/pending-view.tsx`:

```tsx
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

interface Props {
  room: RoomSnapshotDto
}

export function PendingView({ room }: Props) {
  return (
    <div className="space-y-2 rounded-lg border bg-surface p-6 text-center">
      <p className="text-sm uppercase tracking-wider text-muted-foreground">
        Sala #{room.code}
      </p>
      <h2 className="text-xl font-medium">Em breve: Draft</h2>
      <p className="text-sm text-muted-foreground">
        A próxima vertical do Draft Duel vai habilitar a fase de seleção dos atletas
        nesta sala. Status atual: {room.status}.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write failing test for `LobbyView`**

Create `src/app/(app)/rooms/[id]/lobby-view.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { LobbyView } from './lobby-view'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function wrap(ui: ReactNode) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const room = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'K7M2QH',
  status: 'waiting' as const,
  match: {
    id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled' as const,
    homeTeam: { id: 'th', name: 'Flamengo', shortName: 'Flamengo', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { id: 'ta', name: 'Palmeiras', shortName: 'Palmeiras', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
  },
  host: { id: 'h', nickname: 'alice' },
  guest: null,
  winner: null,
  expiresAt: '2026-05-18T20:00:00.000Z',
  createdAt: '2026-05-17T10:00:00.000Z',
}

describe('LobbyView', () => {
  it('shows the invite link, opponent skeleton, and match summary', () => {
    wrap(<LobbyView room={room} isHost />)
    expect(screen.getByText('Flamengo')).toBeInTheDocument()
    expect(screen.getByText('Palmeiras')).toBeInTheDocument()
    expect(screen.getByText(/aguardando oponente/i)).toBeInTheDocument()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('K7M2QH')
    expect(screen.getByRole('button', { name: /abandonar sala/i })).toBeInTheDocument()
  })

  it('does not show invite link or abandon button for non-hosts', () => {
    wrap(<LobbyView room={room} isHost={false} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /abandonar sala/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Implement `LobbyView`**

```tsx
'use client'

import type { RoomSnapshotDto } from '@/lib/contracts/rooms'
import { InviteLinkCard } from '@/components/rooms/InviteLinkCard'
import { OpponentSlot } from '@/components/rooms/OpponentSlot'
import { MatchSummary } from '@/components/rooms/MatchSummary'
import { RoomActions } from '@/components/rooms/RoomActions'

interface Props {
  room: RoomSnapshotDto
  isHost: boolean
}

export function LobbyView({ room, isHost }: Props) {
  return (
    <div className="space-y-6">
      <MatchSummary match={room.match} />
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Oponente
        </p>
        <OpponentSlot opponent={room.guest ? { nickname: room.guest.nickname } : null} />
      </div>
      {isHost && <InviteLinkCard code={room.code} />}
      <RoomActions roomId={room.id} showAbandon={isHost} />
    </div>
  )
}
```

- [ ] **Step 4: Implement the dispatcher page**

Replace `src/app/(app)/rooms/[id]/page.tsx`:

```tsx
'use client'

import { use } from 'react'
import { useRoom } from '@/hooks/useRoom'
import { useRoomSocket } from '@/hooks/useRoomSocket'
import { useAuth } from '@/hooks/useAuth'
import { RoomStatus } from '@/lib/contracts/rooms'
import { LobbyView } from './lobby-view'
import { PendingView } from './pending-view'

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const room = useRoom(id)
  const { user } = useAuth()
  useRoomSocket(id)

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      {room.isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}
      {room.isError && (
        <p className="text-event-negative text-sm">Não foi possível carregar a sala.</p>
      )}
      {room.data && (() => {
        const isHost = user?.id === room.data.host.id
        if (room.data.status === RoomStatus.WAITING) {
          return <LobbyView room={room.data} isHost={isHost} />
        }
        return <PendingView room={room.data} />
      })()}
    </main>
  )
}
```

- [ ] **Step 5: Run unit tests**

Run: `npm test -- lobby-view`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/rooms/\[id\]/
git commit -m "feat(rooms): LobbyView + PendingView dispatcher on /rooms/[id]"
```

---

## Task 14: `/rooms/join/[code]` — public invite landing

**Files:**
- Create: `src/app/rooms/join/[code]/page.tsx`
- Create: `src/app/rooms/join/[code]/page.test.tsx`

OUTSIDE the `(app)/` group — link must work for unauthenticated users. Page calls `useRoomPreview(code)` (public), shows the match + host name, and a button that either redirects to login or calls `useJoinRoom`.

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import RoomJoinPage from './page'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const userMock = { id: 'u-guest' }
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: userMock, isLoading: false }),
}))

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const preview = {
  code: 'K7M2QH',
  status: 'waiting',
  match: {
    kickoffAt: '2026-05-18T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { name: 'Flamengo', shortName: 'F', abbreviation: 'FLA', primaryColor: '#FF0000', secondaryColor: '#000000' },
    awayTeam: { name: 'Palmeiras', shortName: 'P', abbreviation: 'PAL', primaryColor: '#006633', secondaryColor: '#FFFFFF' },
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
    wrap(<RoomJoinPage params={Promise.resolve({ code: 'K7M2QH' })} />)
    await waitFor(() => expect(screen.getByText(/alice/i)).toBeInTheDocument())
    expect(screen.getByText(/Flamengo/i)).toBeInTheDocument()
    expect(screen.getByText(/Palmeiras/i)).toBeInTheDocument()
  })

  it('joins and navigates to /rooms/<id> on click', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValueOnce(preview)
    vi.mocked(api.post).mockResolvedValueOnce({
      id: 'r-1',
      code: 'K7M2QH',
      status: 'drafting',
      match: { ...preview.match, id: 'm-1', homeTeam: { ...preview.match.homeTeam, id: 'h' }, awayTeam: { ...preview.match.awayTeam, id: 'a' } },
      host: { id: 'h', nickname: 'alice' },
      guest: { id: 'u-guest', nickname: 'bob' },
      winner: null,
      expiresAt: preview.expiresAt,
      createdAt: '2026-05-17T10:00:00.000Z',
    })
    wrap(<RoomJoinPage params={Promise.resolve({ code: 'K7M2QH' })} />)
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/rooms/r-1'))
  })
})
```

- [ ] **Step 2: Implement the page**

Create `src/app/rooms/join/[code]/page.tsx`:

```tsx
'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useRoomPreview } from '@/hooks/useRoomPreview'
import { useJoinRoom } from '@/hooks/useJoinRoom'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { RoomErrorCode, RoomStatus } from '@/lib/contracts/rooms'
import { getLoginPath } from '@/lib/auth'

export default function RoomJoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const preview = useRoomPreview(code)
  const join = useJoinRoom()

  function handleJoin() {
    if (!user) {
      router.push(getLoginPath(`/rooms/join/${code}`))
      return
    }
    join.mutate(
      { code },
      {
        onSuccess: (snapshot) => router.push(`/rooms/${snapshot.id}`),
      },
    )
  }

  if (authLoading || preview.isLoading) {
    return (
      <main className="container mx-auto max-w-md px-4 py-12">
        <div className="flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    )
  }

  if (preview.isError) {
    const status = preview.error instanceof ApiError ? preview.error.status : 0
    const msg =
      status === 404
        ? 'Sala não encontrada.'
        : status === 410
          ? 'Esse link de sala já expirou.'
          : 'Não foi possível carregar o convite.'
    return (
      <main className="container mx-auto max-w-md px-4 py-12">
        <p className="text-event-negative text-sm">{msg}</p>
      </main>
    )
  }

  if (!preview.data) return null

  if (preview.data.status !== RoomStatus.WAITING) {
    return (
      <main className="container mx-auto max-w-md px-4 py-12 text-center space-y-2">
        <h1 className="text-xl font-medium">Essa sala já está em andamento.</h1>
        <p className="text-sm text-muted-foreground">
          O anfitrião já recebeu um oponente.
        </p>
      </main>
    )
  }

  const joinError = join.error
  const joinErrorCode =
    joinError instanceof ApiError
      ? ((joinError as ApiError & { code?: string }).code ?? null)
      : null

  return (
    <main className="container mx-auto max-w-md px-4 py-12 space-y-6">
      <header className="text-center space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Você foi convidado
        </p>
        <h1 className="text-2xl font-semibold">
          {preview.data.host.nickname} chamou você pro Draft Duel
        </h1>
      </header>

      <div className="rounded-lg border bg-surface p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {new Date(preview.data.match.kickoffAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="text-lg font-medium">
          {preview.data.match.homeTeam.name} × {preview.data.match.awayTeam.name}
        </p>
      </div>

      {joinErrorCode === RoomErrorCode.IS_HOST && (
        <p className="text-sm text-event-negative text-center">
          Você é o anfitrião dessa sala.
        </p>
      )}
      {joinErrorCode === RoomErrorCode.ROOM_NOT_OPEN && (
        <p className="text-sm text-event-negative text-center">
          Essa sala já está em andamento.
        </p>
      )}
      {joinErrorCode === RoomErrorCode.ROOM_EXPIRED && (
        <p className="text-sm text-event-negative text-center">
          Esse link já expirou.
        </p>
      )}

      <Button
        type="button"
        className="w-full"
        onClick={handleJoin}
        disabled={join.isPending}
      >
        {join.isPending ? 'Entrando…' : user ? 'Entrar na sala' : 'Fazer login pra entrar'}
      </Button>
    </main>
  )
}
```

- [ ] **Step 3: Expose error `code` on `ApiError`**

Open `src/lib/api.ts`. Update `ApiError` to also carry the `code` field returned by the API (the API responds with `{ code, message, statusCode }`):

```ts
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
```

And in `executeRequest`, pass it through:

```ts
if (!res.ok) {
  const errBody = body as { message?: string; code?: string }
  throw new ApiError(res.status, errBody.message ?? res.statusText, errBody.code)
}
```

- [ ] **Step 4: Run page tests**

Run: `npm test -- 'rooms/join'`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/rooms/join src/lib/api.ts
git commit -m "feat(rooms): /rooms/join/[code] public preview + confirm flow"
```

---

## Task 15: "Criar sala" CTA on `/matches/[id]`

**Files:**
- Modify: `src/app/matches/[id]/page.tsx`

Adds a primary button right under the match card. Calls `useCreateRoom` and redirects to `/rooms/<id>`. Auth-gated: if not logged in, the button text becomes "Fazer login pra criar sala".

- [ ] **Step 1: Update `src/app/matches/[id]/page.tsx`**

Find the existing implementation. Add to the imports:

```tsx
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useCreateRoom } from '@/hooks/useCreateRoom'
import { useAuth } from '@/hooks/useAuth'
import { getLoginPath } from '@/lib/auth'
```

Inside the component, add hooks (next to existing `match`, `lineups`, `championships`):

```tsx
const router = useRouter()
const { user } = useAuth()
const createRoom = useCreateRoom()

function handleCreateRoom() {
  if (!match.data) return
  if (!user) {
    router.push(getLoginPath(`/matches/${match.data.id}`))
    return
  }
  createRoom.mutate(
    { matchId: match.data.id },
    {
      onSuccess: (snapshot) => router.push(`/rooms/${snapshot.id}`),
    },
  )
}
```

Inside the rendered JSX, after the `MatchCard` block (`<MatchCard match={match.data} />`), add:

```tsx
{match.data.status !== 'finished' && (
  <Button
    type="button"
    className="mt-4 w-full"
    onClick={handleCreateRoom}
    disabled={createRoom.isPending}
  >
    {createRoom.isPending
      ? 'Criando sala…'
      : user
        ? 'Criar sala'
        : 'Fazer login pra criar sala'}
  </Button>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles without errors.

- [ ] **Step 3: Smoke-test in dev**

```bash
npm run dev
```
Open `http://localhost:3000/matches/<some-id>` (use one from the seeded catalog). Click "Criar sala". Verify redirect to `/rooms/<id>`. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/app/matches/\[id\]/page.tsx
git commit -m "feat(rooms): Criar sala CTA on /matches/[id]"
```

---

## Task 16: "Minhas salas" section on `/me`

**Files:**
- Modify: `src/app/(app)/me/page.tsx`

Adds a section below the profile header that lists active rooms first, then a separator, then finished rooms.

- [ ] **Step 1: Update `src/app/(app)/me/page.tsx`**

Add imports:

```tsx
import Link from 'next/link'
import { useMyRooms } from '@/hooks/useMyRooms'
import { Separator } from '@/components/ui/separator'
import type { RoomSummaryDto } from '@/lib/contracts/rooms'
```

After the existing `header` block (before the "Sair" button), add:

```tsx
<MyRoomsSection />
<Separator />
```

And add the section component at the bottom of the file:

```tsx
function MyRoomsSection() {
  const my = useMyRooms()

  if (my.isLoading) return null
  if (!my.data) return null

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Minhas salas
      </h2>

      {my.data.active.length === 0 && my.data.finished.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem salas. Crie uma na página de uma partida.
        </p>
      )}

      {my.data.active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Ativas</p>
          <ul className="space-y-2">
            {my.data.active.map((room) => (
              <RoomLink key={room.id} room={room} />
            ))}
          </ul>
        </div>
      )}

      {my.data.finished.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Finalizadas</p>
          <ul className="space-y-2">
            {my.data.finished.map((room) => (
              <RoomLink key={room.id} room={room} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function RoomLink({ room }: { room: RoomSummaryDto }) {
  return (
    <li>
      <Link
        href={`/rooms/${room.id}`}
        className="block rounded-md border bg-surface px-3 py-2 hover:border-primary"
      >
        <p className="text-sm font-medium">
          {room.match.homeTeam.name} × {room.match.awayTeam.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {room.role === 'host' ? 'Anfitrião' : 'Convidado'} ·{' '}
          {room.opponent?.nickname ?? '—'} · {room.status}
        </p>
      </Link>
    </li>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/me/page.tsx
git commit -m "feat(rooms): Minhas salas section on /me"
```

---

## Task 17: Playwright E2E — `test/e2e/room-creation.spec.ts`

**Files:**
- Create: `test/e2e/room-creation.spec.ts`

Two-context Playwright spec validating the full host+guest flow including the live `room:guest_joined` propagation.

**Prerequisite:** the API repo (`draft-duel-game-api`) must be running locally on `:3001` with the rooms vertical merged. Stub email provider must be on so `lastTokenFor` works. The existing `auth-flow.spec.ts` uses the same pattern — mirror its login helper.

- [ ] **Step 1: Look up the existing login helper**

Read `test/e2e/auth-flow.spec.ts` and `test/e2e/catalog.spec.ts`. Identify how they perform login (likely by reading the magic-link token from a `/_test/last-token` endpoint or by intercepting the email stub). **Reuse** that helper — do not duplicate.

If the helper is inlined per-spec, lift it to `test/e2e/helpers/login.ts` and have both files import from there.

- [ ] **Step 2: Write the spec**

```ts
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'
import { loginAs } from './helpers/login' // adjust path if you lifted differently

async function newLoggedContext(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAs(page, email)
  return { context, page }
}

test.describe('Rooms — host creates, guest joins, host sees update live', () => {
  test('happy path with two contexts', async ({ browser }) => {
    const host = await newLoggedContext(browser, 'pw-host@test.dev')
    const guest = await newLoggedContext(browser, 'pw-guest@test.dev')

    // 1. Host navigates to a scheduled match in the catalog.
    await host.page.goto('/')
    await host.page.getByRole('link', { name: /brasileirão/i }).click()
    // First match link in the round listing.
    await host.page.locator('article[data-testid="match-card"] a').first().click()

    // 2. Host clicks "Criar sala" and is taken to /rooms/<id>.
    await host.page.getByRole('button', { name: /criar sala/i }).click()
    await expect(host.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)

    // 3. Host sees the invite link with the room code, and the OpponentSlot is waiting.
    const inviteInput = host.page.getByRole('textbox')
    await expect(inviteInput).toHaveValue(/\/rooms\/join\//)
    const inviteUrl = await inviteInput.inputValue()
    const code = inviteUrl.split('/').pop()!
    await expect(host.page.getByText(/aguardando oponente/i)).toBeVisible()

    // 4. Guest opens the same invite URL in a separate context.
    await guest.page.goto(`/rooms/join/${code}`)
    await expect(guest.page.getByRole('button', { name: /entrar na sala/i })).toBeVisible()
    await guest.page.getByRole('button', { name: /entrar na sala/i }).click()
    await expect(guest.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)

    // 5. Host's lobby updates within 5s — the OpponentSlot now shows guest nickname.
    await expect(host.page.getByText(/aguardando oponente/i)).not.toBeVisible({ timeout: 5000 })

    await host.context.close()
    await guest.context.close()
  })

  test('host clicks own invite link → sees IS_HOST message', async ({ browser }) => {
    const host = await newLoggedContext(browser, 'pw-selfjoin@test.dev')
    // create the room
    await host.page.goto('/')
    await host.page.getByRole('link', { name: /brasileirão/i }).click()
    await host.page.locator('article[data-testid="match-card"] a').first().click()
    await host.page.getByRole('button', { name: /criar sala/i }).click()
    const inviteUrl = await host.page.getByRole('textbox').inputValue()
    const code = inviteUrl.split('/').pop()!

    // open invite in same context
    await host.page.goto(`/rooms/join/${code}`)
    await host.page.getByRole('button', { name: /entrar na sala/i }).click()
    await expect(host.page.getByText(/você é o anfitrião/i)).toBeVisible({ timeout: 5000 })

    await host.context.close()
  })
})
```

- [ ] **Step 3: Add `data-testid="match-card"` to `MatchCard` if not already present**

Open `src/components/MatchCard.tsx`. If the wrapping `<article>` doesn't have `data-testid="match-card"`, add it. The Playwright spec relies on this selector to pick a match deterministically.

- [ ] **Step 4: Boot the API**

In a separate terminal:

```bash
cd ../draft-duel-game-api
docker compose up -d
npm run start:dev
```
Wait for `Nest application successfully started`.

- [ ] **Step 5: Run Playwright**

```bash
npm run test:e2e -- room-creation
```
Expected: both tests pass. May take ~30-60s.

- [ ] **Step 6: Commit**

```bash
git add test/e2e/room-creation.spec.ts test/e2e/helpers src/components/MatchCard.tsx
git commit -m "test(rooms): Playwright e2e — host/guest two-context flow with live WS update"
```

---

## Task 18: README + final lint

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

In `README.md`, update the "Próximos passos" section: mark item 3 ("Criação de sala") as done. Move that text into the "O que está implementado" section as a new subsection:

```markdown
### Rooms (lobby vertical)

- `/matches/[id]` ganha o botão "Criar sala" que cria a sala e redireciona
  pro lobby
- `/rooms/[id]` é um dispatcher por status: `LobbyView` em `WAITING`
  (invite link, OpponentSlot real-time, MatchSummary, botão abandonar),
  `PendingView` placeholder em qualquer outro estado
- `/rooms/join/[code]` é a página pública de preview do convite
  (suporta usuário deslogado — redireciona pro login retornando ao convite)
- `/me` lista "Minhas salas" (Ativas + Finalizadas)
- `useRoomSocket` abre o canal `room:<id>` e sincroniza `room:guest_joined`,
  `room:abandoned` no cache TanStack
```

Also update the "Hooks" table to include the new hooks.

- [ ] **Step 2: Final lint + tests**

Run: `npm run lint && npm test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): document rooms lobby vertical on frontend"
```

---

## Verification checklist (DoD from spec §12)

- [ ] `/matches/[id]` has a working "Criar sala" button
- [ ] `/rooms/join/[code]` shows preview and "Entrar" button; handles 404 / 410 / IS_HOST / ROOM_NOT_OPEN
- [ ] `/rooms/[id]` renders `LobbyView` in WAITING; `PendingView` in DRAFTING / LIVE / FINISHED
- [ ] `/me` lists active+finished rooms
- [ ] WS connects after login and `room:guest_joined` updates the lobby in < 2s during the Playwright spec
- [ ] `useRoomSocket` unit + Playwright happy-path with two contexts
- [ ] `npm test`, `npm run test:e2e`, `npm run lint` all green

When all boxes are checked: open PR `feat/room-creation-frontend` → `main`.
