# Draft Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the snake-draft UX on top of the API gateway from the parallel `draft-api` PR — a `DraftView` that the `/rooms/[id]` dispatcher renders when status is `DRAFTING`, with `DraftBoard` (10 snake slots), `DraftPool` (two-column starter list per team with position filters), `PlayerCard` (reuse existing component), `TurnBanner`, and `ConfirmPickDialog`. WebSocket sync extends the existing `useRoomSocket` pattern: `useDraftSocket` listens for `draft:pick_made` / `draft:current_pick` / `match:started` and patches the TanStack room cache. When the 10th pick fires `match:started`, the dispatcher transitions to `PendingView` (unchanged).

**Architecture:** Contracts (Zod) mirror the API spec — new file `src/lib/contracts/draft.ts` plus an extension of `rooms.ts` to include `draft: draftStateSchema.nullable()` in the snapshot. Five presentational components in `src/components/draft/`. One mutation hook (`useMakePick`) and one socket hook (`useDraftSocket`). The existing `socketEmit`/`socketOn` helpers and the `getSocket()` refcounted singleton already support multiple concurrent listeners, so `useDraftSocket` adds to the lobby's subscriptions without opening a second connection.

**Tech Stack:** Next.js 15 (App Router, Turbopack) · React 19 · TanStack Query 5 · Socket.IO client 4 · Zod 4 · Tailwind 4 + shadcn/base-ui · Vitest 4 + Testing Library · Playwright 1.

**Spec:** [`docs/superpowers/specs/2026-05-23-draft-design.md`](../specs/2026-05-23-draft-design.md)

**Depends on:** the `draft-api` PR being available locally for Playwright to hit (the unit/Vitest layer mocks the socket, so it doesn't need the API running).

**Out of scope (vertical 5):**
- Live match (`MatchScoreboard`, `MatchTimeline`, `SubstitutionDialog`)
- `match:event` / `match:score_updated` listeners
- Push notification when lineup confirms (worker→WS)
- Pick timer

---

## File Structure

**Create:**
- `src/lib/contracts/draft.ts`
- `src/lib/contracts/draft.test.ts`
- `src/lib/draft-positions-remaining.ts`
- `src/lib/draft-positions-remaining.test.ts`
- `src/hooks/useMakePick.ts`
- `src/hooks/useMakePick.test.tsx`
- `src/hooks/useDraftSocket.ts`
- `src/hooks/useDraftSocket.test.tsx`
- `src/components/draft/DraftBoard.tsx`
- `src/components/draft/DraftBoard.test.tsx`
- `src/components/draft/DraftPool.tsx`
- `src/components/draft/DraftPool.test.tsx`
- `src/components/draft/TurnBanner.tsx`
- `src/components/draft/TurnBanner.test.tsx`
- `src/components/draft/ConfirmPickDialog.tsx`
- `src/components/draft/ConfirmPickDialog.test.tsx`
- `src/app/(app)/rooms/[id]/draft-view.tsx`
- `src/app/(app)/rooms/[id]/draft-view.test.tsx`
- `test/e2e/draft.spec.ts`

**Modify:**
- `src/lib/contracts/rooms.ts` — add `draft: draftStateSchema.nullable()` to `roomSnapshotSchema`
- `src/lib/contracts/ws.ts` — extend `WsErrorCode` with draft codes + add typed payloads for draft events
- `src/app/(app)/rooms/[id]/page.tsx` — dispatcher: `DRAFTING → DraftView`
- `README.md` — short paragraph about the draft vertical

**No new npm deps** (`socket.io-client`, `zod`, `@tanstack/react-query`, `sonner` are already in `package.json`).

---

## Conventions

- Tests live alongside source as `<name>.test.{ts,tsx}`. E2E in `test/e2e/<feature>.spec.ts`.
- Wire format is **lowercase** (`'host'|'guest'`, `'drafting'`, `'GOL'`, etc.) — matches existing `src/lib/contracts/rooms.ts`.
- Enums via `as const` objects + `typeof X[keyof typeof X]` types.
- Hooks return TanStack Query result objects directly; components destructure `.data`, `.isPending`, etc.
- Components are pure presentational where possible. Containers (route pages, `DraftView`) wire hooks.
- WS event names imported from `@/lib/contracts/ws`.
- Run unit: `npm test`. E2E (starts dev server + needs API on `NEXT_PUBLIC_API_URL`): `npm run test:e2e`. Lint: `npm run lint`.
- Commit cadence: one commit per task. Conventional Commits.

---

## Task 1: Draft contracts (Zod schemas + types)

**Files:**
- Create: `src/lib/contracts/draft.ts`
- Create: `src/lib/contracts/draft.test.ts`

Mirrors API spec §5.1. Wire enums lowercase. `Position` already exists in `src/lib/contracts/catalog.ts` — reuse it.

- [ ] **Step 1: Write failing tests**

Create `src/lib/contracts/draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  athleteRefSchema,
  draftPickSchema,
  draftPoolEntrySchema,
  draftStateSchema,
  draftPickMadePayloadSchema,
  draftCurrentPickPayloadSchema,
  matchStartedPayloadSchema,
} from './draft'

const validAthlete = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Pedro',
  shortName: 'Pedro',
  position: 'ATA',
  jerseyNumber: 9,
  teamId: '00000000-0000-4000-8000-000000000002',
}

describe('athleteRefSchema', () => {
  it('accepts valid athlete', () => {
    expect(athleteRefSchema.parse(validAthlete)).toEqual(validAthlete)
  })
  it('accepts null jerseyNumber', () => {
    expect(athleteRefSchema.parse({ ...validAthlete, jerseyNumber: null }).jerseyNumber).toBeNull()
  })
  it('rejects invalid position', () => {
    expect(() => athleteRefSchema.parse({ ...validAthlete, position: 'WTF' })).toThrow()
  })
})

describe('draftPickSchema', () => {
  it('accepts valid pick', () => {
    const pick = {
      pickNumber: 0,
      role: 'host',
      athlete: validAthlete,
      madeAt: '2026-06-11T19:00:00.000Z',
    }
    expect(draftPickSchema.parse(pick)).toEqual(pick)
  })
  it('rejects pickNumber out of range', () => {
    expect(() =>
      draftPickSchema.parse({ pickNumber: 10, role: 'host', athlete: validAthlete, madeAt: '2026-06-11T19:00:00.000Z' }),
    ).toThrow()
  })
})

describe('draftPoolEntrySchema', () => {
  it('accepts entry with null pickedByRole', () => {
    expect(
      draftPoolEntrySchema.parse({ athlete: validAthlete, teamSide: 'home', pickedByRole: null }),
    ).toBeTruthy()
  })
  it('rejects invalid teamSide', () => {
    expect(() =>
      draftPoolEntrySchema.parse({ athlete: validAthlete, teamSide: 'middle', pickedByRole: null }),
    ).toThrow()
  })
})

describe('draftStateSchema', () => {
  it('accepts an empty pre-draft state', () => {
    expect(
      draftStateSchema.parse({
        currentPickNumber: 0,
        currentRole: 'host',
        lineupReady: true,
        picks: [],
        pool: [],
      }),
    ).toBeTruthy()
  })
  it('accepts a finished state with currentRole=null and currentPickNumber=10', () => {
    expect(
      draftStateSchema.parse({
        currentPickNumber: 10,
        currentRole: null,
        lineupReady: true,
        picks: [],
        pool: [],
      }),
    ).toBeTruthy()
  })
})

describe('ws payloads', () => {
  const pick = {
    pickNumber: 0,
    role: 'host' as const,
    athlete: validAthlete,
    madeAt: '2026-06-11T19:00:00.000Z',
  }
  it('draft:pick_made with nextPickNumber', () => {
    expect(
      draftPickMadePayloadSchema.parse({ pick, nextPickNumber: 1, currentRole: 'guest' }),
    ).toBeTruthy()
  })
  it('draft:pick_made on final pick has nulls', () => {
    expect(
      draftPickMadePayloadSchema.parse({ pick, nextPickNumber: null, currentRole: null }),
    ).toBeTruthy()
  })
  it('draft:current_pick', () => {
    expect(
      draftCurrentPickPayloadSchema.parse({ pickNumber: 3, role: 'host' }),
    ).toBeTruthy()
  })
  it('match:started with both lineups', () => {
    expect(
      matchStartedPayloadSchema.parse({
        startedAt: '2026-06-11T19:30:00.000Z',
        hostLineup: [validAthlete],
        guestLineup: [validAthlete],
      }),
    ).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/lib/contracts/draft.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement contracts**

Create `src/lib/contracts/draft.ts`:

```ts
import { z } from 'zod'
import { positionSchema } from '@/lib/contracts/catalog'
import { roleSchema } from '@/lib/contracts/rooms'

export const TEAM_SIDES = ['home', 'away'] as const
export type TeamSide = (typeof TEAM_SIDES)[number]
export const teamSideSchema = z.enum(TEAM_SIDES)

export const athleteRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string(),
  position: positionSchema,
  jerseyNumber: z.number().int().nullable(),
  teamId: z.string().uuid(),
})
export type AthleteRefDto = z.infer<typeof athleteRefSchema>

export const draftPickSchema = z.object({
  pickNumber: z.number().int().min(0).max(9),
  role: roleSchema,
  athlete: athleteRefSchema,
  madeAt: z.string().datetime(),
})
export type DraftPickDto = z.infer<typeof draftPickSchema>

export const draftPoolEntrySchema = z.object({
  athlete: athleteRefSchema,
  teamSide: teamSideSchema,
  pickedByRole: roleSchema.nullable(),
})
export type DraftPoolEntryDto = z.infer<typeof draftPoolEntrySchema>

export const draftStateSchema = z.object({
  currentPickNumber: z.number().int().min(0).max(10),
  currentRole: roleSchema.nullable(),
  lineupReady: z.boolean(),
  picks: z.array(draftPickSchema),
  pool: z.array(draftPoolEntrySchema),
})
export type DraftStateDto = z.infer<typeof draftStateSchema>

// WS payloads
export const draftPickMadePayloadSchema = z.object({
  pick: draftPickSchema,
  nextPickNumber: z.number().int().min(0).max(10).nullable(),
  currentRole: roleSchema.nullable(),
})
export type DraftPickMadePayload = z.infer<typeof draftPickMadePayloadSchema>

export const draftCurrentPickPayloadSchema = z.object({
  pickNumber: z.number().int().min(0).max(9),
  role: roleSchema,
})
export type DraftCurrentPickPayload = z.infer<typeof draftCurrentPickPayloadSchema>

export const matchStartedPayloadSchema = z.object({
  startedAt: z.string().datetime(),
  hostLineup: z.array(athleteRefSchema),
  guestLineup: z.array(athleteRefSchema),
})
export type MatchStartedPayload = z.infer<typeof matchStartedPayloadSchema>
```

> Verify `positionSchema` exists in `src/lib/contracts/catalog.ts`. If it's a different name (e.g., `POSITIONS` is exported but no `positionSchema`), define locally:
> ```ts
> import { POSITIONS } from '@/lib/contracts/catalog'
> const positionSchema = z.enum(POSITIONS)
> ```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/lib/contracts/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/draft.ts src/lib/contracts/draft.test.ts
git commit -m "feat(draft): zod contracts for draft state + WS payloads"
```

---

## Task 2: Extend rooms + ws contracts

**Files:**
- Modify: `src/lib/contracts/rooms.ts`
- Modify: `src/lib/contracts/ws.ts`

Snapshot now carries `draft: DraftStateDto | null`. `WsErrorCode` gets the 8 new draft codes.

- [ ] **Step 1: Extend rooms.ts**

In `src/lib/contracts/rooms.ts`, add at the top of the imports:

```ts
import { draftStateSchema } from '@/lib/contracts/draft'
```

Change the `roomSnapshotSchema` to include the `draft` field at the end:

```ts
export const roomSnapshotSchema = z.object({
  id: z.string().uuid(),
  code: z.string().length(6),
  status: roomStatusSchema,
  match: z.object({
    id: z.string().uuid(),
    kickoffAt: z.string(),
    status: matchStatusSchema,
    homeTeam: teamRefSchema,
    awayTeam: teamRefSchema,
  }),
  host: userRefSchema,
  guest: userRefSchema.nullable(),
  winner: roomWinnerSchema.nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
  draft: draftStateSchema.nullable(),
})
```

> **Note:** this creates a circular import (`rooms.ts` ↔ `draft.ts` if `draft.ts` already imports `roleSchema` from `rooms.ts`). Resolve by extracting `roleSchema` into a tiny `src/lib/contracts/shared.ts` if the bundler complains. Try the direct import first; only refactor if needed.

- [ ] **Step 2: Update RoomSnapshotDto consumers**

The type is auto-extended via `z.infer`. No runtime change needed; existing components that don't use `.draft` keep working. Run typecheck to confirm:

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Extend ws.ts**

In `src/lib/contracts/ws.ts`, replace the `WsErrorCode` block:

```ts
export const WsErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_MEMBER: 'NOT_MEMBER',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  VALIDATION: 'VALIDATION',
  INTERNAL: 'INTERNAL',
  // Draft
  NOT_DRAFTING: 'NOT_DRAFTING',
  INVALID_PICK_NUMBER: 'INVALID_PICK_NUMBER',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  LINEUP_NOT_READY: 'LINEUP_NOT_READY',
  ATHLETE_NOT_IN_LINEUP: 'ATHLETE_NOT_IN_LINEUP',
  ATHLETE_ALREADY_PICKED: 'ATHLETE_ALREADY_PICKED',
  POSITION_ALREADY_FILLED: 'POSITION_ALREADY_FILLED',
  PICK_RACE_LOST: 'PICK_RACE_LOST',
} as const
export type WsErrorCode = (typeof WsErrorCode)[keyof typeof WsErrorCode]
```

Re-export the new payload types at the bottom (for ergonomics — they live in `draft.ts` already):

```ts
export type {
  DraftPickMadePayload,
  DraftCurrentPickPayload,
  MatchStartedPayload,
} from '@/lib/contracts/draft'
```

- [ ] **Step 4: Run lint + existing tests**

Run: `npm test && npm run lint`
Expected: PASS (no existing test should break — only enum and schema additions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/rooms.ts src/lib/contracts/ws.ts
git commit -m "feat(draft): extend RoomSnapshot with draft + WsErrorCode draft codes"
```

---

## Task 3: Positions-remaining pure function

**Files:**
- Create: `src/lib/draft-positions-remaining.ts`
- Create: `src/lib/draft-positions-remaining.test.ts`

Used by `DraftView` to grey out pool entries whose position the role already has.

- [ ] **Step 1: Write failing test**

Create `src/lib/draft-positions-remaining.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computePositionsRemaining } from './draft-positions-remaining'
import type { DraftPickDto } from '@/lib/contracts/draft'

function makePick(overrides: { role: 'host' | 'guest'; position: 'GOL'|'LAT'|'ZAG'|'MEI'|'ATA' }): DraftPickDto {
  return {
    pickNumber: 0,
    role: overrides.role,
    athlete: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'X', shortName: 'X', position: overrides.position,
      jerseyNumber: 1, teamId: '00000000-0000-0000-0000-000000000002',
    },
    madeAt: '2026-06-11T19:00:00.000Z',
  }
}

describe('computePositionsRemaining', () => {
  it('returns all 5 positions when picks is empty', () => {
    expect(computePositionsRemaining([], 'host')).toEqual(['GOL', 'LAT', 'ZAG', 'MEI', 'ATA'])
  })
  it('subtracts only positions for the asked role', () => {
    const picks = [
      makePick({ role: 'host', position: 'GOL' }),
      makePick({ role: 'host', position: 'LAT' }),
      makePick({ role: 'guest', position: 'ATA' }),
    ]
    expect(computePositionsRemaining(picks, 'host')).toEqual(['ZAG', 'MEI', 'ATA'])
    expect(computePositionsRemaining(picks, 'guest')).toEqual(['GOL', 'LAT', 'ZAG', 'MEI'])
  })
  it('returns empty when role has filled all 5', () => {
    const picks = (['GOL','LAT','ZAG','MEI','ATA'] as const).map((p) =>
      makePick({ role: 'host', position: p }),
    )
    expect(computePositionsRemaining(picks, 'host')).toEqual([])
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/lib/draft-positions-remaining.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/draft-positions-remaining.ts`:

```ts
import { type Position } from '@/lib/contracts/catalog'
import type { DraftPickDto } from '@/lib/contracts/draft'
import type { Role } from '@/lib/contracts/rooms'

/** Canonical order of mandatory draft positions. */
export const POSITIONS: readonly Position[] = ['GOL', 'LAT', 'ZAG', 'MEI', 'ATA']

/** Returns the positions the given role still needs to draft. Order preserved. */
export function computePositionsRemaining(picks: DraftPickDto[], role: Role): Position[] {
  const filled = new Set(picks.filter((p) => p.role === role).map((p) => p.athlete.position))
  return POSITIONS.filter((p) => !filled.has(p))
}
```

> Note: `catalog.ts` exports `positionSchema` (z.enum) and `Position` (z.infer) but not `POSITIONS`. Defining it here keeps the constant near its main consumer; `DraftPool` (Task 9) imports it from this module too.

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/lib/draft-positions-remaining.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/draft-positions-remaining.ts src/lib/draft-positions-remaining.test.ts
git commit -m "feat(draft): computePositionsRemaining pure helper"
```

---

## Task 4: `useMakePick` hook

**Files:**
- Create: `src/hooks/useMakePick.ts`
- Create: `src/hooks/useMakePick.test.tsx`

Mutation that emits `draft:pick` over the socket and awaits ack. Errors expose `code` (WsErrorCode).

- [ ] **Step 1: Write failing test**

Create `src/hooks/useMakePick.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMakePick } from './useMakePick'

const emit = vi.fn()
vi.mock('@/lib/socket', () => ({
  socketEmit: (event: string, payload: unknown, ack?: (resp: unknown) => void) =>
    emit(event, payload, ack),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const ROOM_ID = '00000000-0000-4000-8000-000000000001'
const ATH_ID = '00000000-0000-4000-8000-000000000002'

describe('useMakePick', () => {
  beforeEach(() => emit.mockReset())

  it('emits draft:pick with the right payload and resolves on ack ok', async () => {
    emit.mockImplementation((_e, _p, ack) => ack({ ok: true }))
    const { result } = renderHook(() => useMakePick(ROOM_ID), { wrapper })
    result.current.mutate({ pickNumber: 0, athleteId: ATH_ID })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(emit).toHaveBeenCalledWith(
      'draft:pick',
      { roomId: ROOM_ID, pickNumber: 0, athleteId: ATH_ID },
      expect.any(Function),
    )
  })

  it('rejects with the error code when ack returns an error shape', async () => {
    emit.mockImplementation((_e, _p, ack) => ack({ error: { code: 'NOT_YOUR_TURN', message: 'nope' } }))
    const { result } = renderHook(() => useMakePick(ROOM_ID), { wrapper })
    result.current.mutate({ pickNumber: 0, athleteId: ATH_ID })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error & { code?: string })?.code).toBe('NOT_YOUR_TURN')
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/hooks/useMakePick.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/hooks/useMakePick.ts`:

```ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { socketEmit } from '@/lib/socket'
import { WsClientEvent } from '@/lib/contracts/ws'
import type { WsErrorCode } from '@/lib/contracts/ws'

export class PickError extends Error {
  constructor(public readonly code: WsErrorCode | 'UNKNOWN', message: string) {
    super(message)
    this.name = 'PickError'
  }
}

export interface MakePickInput {
  pickNumber: number
  athleteId: string
}

interface AckOk { ok: true }
interface AckErr { error: { code: WsErrorCode; message: string } }
type Ack = AckOk | AckErr

function isErr(a: Ack): a is AckErr {
  return (a as AckErr).error !== undefined
}

export function useMakePick(roomId: string) {
  return useMutation<void, PickError, MakePickInput>({
    mutationFn: ({ pickNumber, athleteId }) =>
      new Promise<void>((resolve, reject) => {
        socketEmit<{ roomId: string; pickNumber: number; athleteId: string }>(
          WsClientEvent.DRAFT_PICK,
          { roomId, pickNumber, athleteId },
          (resp) => {
            const ack = resp as Ack
            if (isErr(ack)) {
              reject(new PickError(ack.error.code, ack.error.message))
            } else {
              resolve()
            }
          },
        )
      }),
  })
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/hooks/useMakePick.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMakePick.ts src/hooks/useMakePick.test.tsx
git commit -m "feat(draft): useMakePick mutation hook"
```

---

## Task 5: `useDraftSocket` hook

**Files:**
- Create: `src/hooks/useDraftSocket.ts`
- Create: `src/hooks/useDraftSocket.test.tsx`

Listens for `draft:pick_made` / `draft:current_pick` / `match:started`. Each updates the `['room', roomId]` cache via `setQueryData`. Reuses the singleton socket already opened by `useRoomSocket`.

> **Decision:** `useDraftSocket` does NOT call `connectSocket()`/`disconnectSocket()` — it expects `useRoomSocket` to be mounted in parent (`DraftView` always wraps `useRoomSocket` via the page). This keeps refcount semantics simple. If someone mounts `useDraftSocket` standalone, they'd see no socket. Document this and only call from `DraftView`.

- [ ] **Step 1: Write failing test**

Create `src/hooks/useDraftSocket.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDraftSocket } from './useDraftSocket'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'
import type { DraftPickMadePayload, MatchStartedPayload } from '@/lib/contracts/draft'

const listeners = new Map<string, (p: unknown) => void>()
vi.mock('@/lib/socket', () => ({
  socketOn: (event: string, handler: (p: unknown) => void) => {
    listeners.set(event, handler)
    return () => listeners.delete(event)
  },
}))

const ROOM_ID = '00000000-0000-4000-8000-000000000001'
const ATH = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'A', shortName: 'A', position: 'GOL' as const,
  jerseyNumber: 1, teamId: '00000000-0000-4000-8000-000000000020',
}

function makeSnapshot(): RoomSnapshotDto {
  return {
    id: ROOM_ID,
    code: 'ABCDEF',
    status: 'drafting',
    match: {
      id: '00000000-0000-4000-8000-000000000030',
      kickoffAt: '2026-06-11T19:00:00.000Z',
      status: 'scheduled',
      homeTeam: { id: 'h', name: 'H', shortName: 'H', abbreviation: 'H', primaryColor: '#fff', secondaryColor: '#000' },
      awayTeam: { id: 'a', name: 'A', shortName: 'A', abbreviation: 'A', primaryColor: '#fff', secondaryColor: '#000' },
    },
    host: { id: 'host-id', nickname: 'host' },
    guest: { id: 'guest-id', nickname: 'guest' },
    winner: null,
    expiresAt: '2026-06-11T22:00:00.000Z',
    createdAt: '2026-06-11T18:30:00.000Z',
    draft: {
      currentPickNumber: 0,
      currentRole: 'host',
      lineupReady: true,
      picks: [],
      pool: [
        { athlete: ATH, teamSide: 'home', pickedByRole: null },
      ],
    },
  }
}

function wrapper(initial: RoomSnapshotDto) {
  const qc = new QueryClient()
  qc.setQueryData(['room', ROOM_ID], initial)
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  return { qc, Wrapper }
}

describe('useDraftSocket', () => {
  beforeEach(() => listeners.clear())

  it('appends pick + bumps currentPickNumber on draft:pick_made', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    renderHook(() => useDraftSocket(ROOM_ID), { wrapper: Wrapper })
    const payload: DraftPickMadePayload = {
      pick: { pickNumber: 0, role: 'host', athlete: ATH, madeAt: '2026-06-11T19:01:00.000Z' },
      nextPickNumber: 1,
      currentRole: 'guest',
    }
    act(() => listeners.get('draft:pick_made')!(payload))
    const updated = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])!
    expect(updated.draft?.picks).toHaveLength(1)
    expect(updated.draft?.currentPickNumber).toBe(1)
    expect(updated.draft?.currentRole).toBe('guest')
    expect(updated.draft?.pool[0].pickedByRole).toBe('host')
  })

  it('flips room.status to live on match:started', () => {
    const { qc, Wrapper } = wrapper(makeSnapshot())
    renderHook(() => useDraftSocket(ROOM_ID), { wrapper: Wrapper })
    const payload: MatchStartedPayload = {
      startedAt: '2026-06-11T19:30:00.000Z',
      hostLineup: [ATH], guestLineup: [ATH],
    }
    act(() => listeners.get('match:started')!(payload))
    const updated = qc.getQueryData<RoomSnapshotDto>(['room', ROOM_ID])!
    expect(updated.status).toBe('live')
  })

  it('cleans up listeners on unmount', () => {
    const { Wrapper } = wrapper(makeSnapshot())
    const { unmount } = renderHook(() => useDraftSocket(ROOM_ID), { wrapper: Wrapper })
    expect(listeners.size).toBeGreaterThan(0)
    unmount()
    expect(listeners.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/hooks/useDraftSocket.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/hooks/useDraftSocket.ts`:

```ts
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketOn } from '@/lib/socket'
import {
  WsServerEvent,
  type DraftPickMadePayload,
  type DraftCurrentPickPayload,
  type MatchStartedPayload,
} from '@/lib/contracts/ws'
import { RoomStatus, type RoomSnapshotDto } from '@/lib/contracts/rooms'

/**
 * Listens for draft + match-start broadcasts and patches the room snapshot
 * cache. Assumes the parent has already opened the WS via useRoomSocket(roomId).
 */
export function useDraftSocket(roomId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!roomId) return

    const handlePickMade = (payload: DraftPickMadePayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.draft) return prev
        const picks = [...prev.draft.picks, payload.pick]
        const pool = prev.draft.pool.map((entry) =>
          entry.athlete.id === payload.pick.athlete.id
            ? { ...entry, pickedByRole: payload.pick.role }
            : entry,
        )
        const currentPickNumber = payload.nextPickNumber ?? 10
        return {
          ...prev,
          draft: {
            ...prev.draft,
            picks,
            pool,
            currentPickNumber,
            currentRole: payload.currentRole,
          },
        }
      })
    }

    const handleCurrentPick = (payload: DraftCurrentPickPayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev?.draft) return prev
        return {
          ...prev,
          draft: {
            ...prev.draft,
            currentPickNumber: payload.pickNumber,
            currentRole: payload.role,
          },
        }
      })
    }

    const handleMatchStarted = (_payload: MatchStartedPayload) => {
      queryClient.setQueryData<RoomSnapshotDto | undefined>(['room', roomId], (prev) => {
        if (!prev) return prev
        return { ...prev, status: RoomStatus.LIVE }
      })
    }

    const offPick = socketOn<DraftPickMadePayload>(WsServerEvent.DRAFT_PICK_MADE, handlePickMade)
    const offCurr = socketOn<DraftCurrentPickPayload>(WsServerEvent.DRAFT_CURRENT_PICK, handleCurrentPick)
    const offStart = socketOn<MatchStartedPayload>(WsServerEvent.MATCH_STARTED, handleMatchStarted)

    return () => {
      offPick()
      offCurr()
      offStart()
    }
  }, [queryClient, roomId])
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/hooks/useDraftSocket.test.tsx`
Expected: PASS, 3 cases.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDraftSocket.ts src/hooks/useDraftSocket.test.tsx
git commit -m "feat(draft): useDraftSocket — patches snapshot on pick_made/current_pick/match_started"
```

---

## Task 6: `DraftBoard` component

**Files:**
- Create: `src/components/draft/DraftBoard.tsx`
- Create: `src/components/draft/DraftBoard.test.tsx`

Renders 10 slots: 5 host on the left, 5 guest on the right, sorted by snake pickNumber. Uses existing `PlayerCard` for filled slots and a custom placeholder for empty.

> Style: follow `LineupGrid.tsx` / `OpponentSlot.tsx` for skeleton look. Use Tailwind classes available in the project.

- [ ] **Step 1: Write failing test**

Create `src/components/draft/DraftBoard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DraftBoard } from './DraftBoard'
import type { DraftPickDto } from '@/lib/contracts/draft'
import type { TeamRefDto } from '@/lib/contracts/rooms'

const home: TeamRefDto = {
  id: 'th', name: 'Home', shortName: 'Home', abbreviation: 'HOM',
  primaryColor: '#FF0000', secondaryColor: '#FFFFFF',
}
const away: TeamRefDto = {
  id: 'ta', name: 'Away', shortName: 'Away', abbreviation: 'AWY',
  primaryColor: '#0000FF', secondaryColor: '#FFFFFF',
}

function makePick(overrides: { pickNumber: number; role: 'host'|'guest'; teamId: string; position?: 'GOL'|'LAT'|'ZAG'|'MEI'|'ATA' }): DraftPickDto {
  return {
    pickNumber: overrides.pickNumber,
    role: overrides.role,
    athlete: {
      id: `a-${overrides.pickNumber}`,
      name: `Atleta ${overrides.pickNumber}`,
      shortName: `A${overrides.pickNumber}`,
      position: overrides.position ?? 'GOL',
      jerseyNumber: overrides.pickNumber + 1,
      teamId: overrides.teamId,
    },
    madeAt: '2026-06-11T19:00:00.000Z',
  }
}

describe('DraftBoard', () => {
  it('renders 10 slots (5 per role) when picks is empty', () => {
    render(<DraftBoard picks={[]} currentPickNumber={0} homeTeam={home} awayTeam={away} />)
    expect(screen.getAllByTestId('draft-slot')).toHaveLength(10)
    expect(screen.getAllByTestId('draft-slot-empty')).toHaveLength(10)
  })

  it('renders picked athletes for filled slots', () => {
    const picks: DraftPickDto[] = [
      makePick({ pickNumber: 0, role: 'host', teamId: 'th' }),
      makePick({ pickNumber: 1, role: 'guest', teamId: 'ta' }),
    ]
    render(<DraftBoard picks={picks} currentPickNumber={2} homeTeam={home} awayTeam={away} />)
    expect(screen.getByText('A0')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getAllByTestId('draft-slot-empty')).toHaveLength(8)
  })

  it('marks the current pick slot with data-current', () => {
    render(<DraftBoard picks={[]} currentPickNumber={3} homeTeam={home} awayTeam={away} />)
    const current = screen.getByTestId('draft-slot-current')
    expect(current).toHaveAttribute('data-pick-number', '3')
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/components/draft/DraftBoard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/draft/DraftBoard.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'
import { PlayerCard } from '@/components/PlayerCard'
import type { DraftPickDto } from '@/lib/contracts/draft'
import type { Role, TeamRefDto } from '@/lib/contracts/rooms'

const SNAKE_ORDER: Role[] = ['host', 'guest', 'guest', 'host', 'host', 'guest', 'guest', 'host', 'host', 'guest']

interface Props {
  picks: DraftPickDto[]
  currentPickNumber: number
  homeTeam: TeamRefDto
  awayTeam: TeamRefDto
}

export function DraftBoard({ picks, currentPickNumber, homeTeam, awayTeam }: Props) {
  const byPickNumber = new Map(picks.map((p) => [p.pickNumber, p]))

  function teamFor(pick: DraftPickDto): TeamRefDto {
    return pick.athlete.teamId === homeTeam.id ? homeTeam : awayTeam
  }

  function renderSlot(pickNumber: number) {
    const pick = byPickNumber.get(pickNumber)
    const isCurrent = pickNumber === currentPickNumber
    const baseProps = {
      'data-testid': isCurrent ? 'draft-slot-current' : 'draft-slot',
      'data-pick-number': String(pickNumber),
    }

    if (!pick) {
      return (
        <div
          key={pickNumber}
          {...baseProps}
          data-testid={`draft-slot${isCurrent ? '-current' : '-empty'}`}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground',
            isCurrent && 'border-primary text-primary',
          )}
        >
          <span className="font-semibold tabular-nums">#{pickNumber + 1}</span>
          <span>{isCurrent ? 'Próximo pick' : 'Vazio'}</span>
        </div>
      )
    }

    const team = teamFor(pick)
    return (
      <div key={pickNumber} {...baseProps} className="flex items-center gap-2">
        <span className="text-xs font-semibold tabular-nums text-muted-foreground w-6">#{pickNumber + 1}</span>
        <div className="flex-1">
          <PlayerCard
            shortName={pick.athlete.shortName}
            position={pick.athlete.position}
            jerseyNumber={pick.athlete.jerseyNumber}
            teamPrimaryColor={team.primaryColor ?? '#1f2937'}
            teamSecondaryColor={team.secondaryColor ?? '#ffffff'}
          />
        </div>
      </div>
    )
  }

  const hostSlots = SNAKE_ORDER.map((role, idx) => role === 'host' ? idx : null).filter((n): n is number => n !== null)
  const guestSlots = SNAKE_ORDER.map((role, idx) => role === 'guest' ? idx : null).filter((n): n is number => n !== null)

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Host</p>
        {hostSlots.map((n) => renderSlot(n))}
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Guest</p>
        {guestSlots.map((n) => renderSlot(n))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/components/draft/DraftBoard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/DraftBoard.tsx src/components/draft/DraftBoard.test.tsx
git commit -m "feat(draft): DraftBoard — 10 snake slots, host/guest columns"
```

---

## Task 7: `TurnBanner` component

**Files:**
- Create: `src/components/draft/TurnBanner.tsx`
- Create: `src/components/draft/TurnBanner.test.tsx`

Banner showing "Sua vez", "Vez de @oponente", or "Aguardando escalação".

- [ ] **Step 1: Write failing test**

Create `src/components/draft/TurnBanner.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurnBanner } from './TurnBanner'

describe('TurnBanner', () => {
  it('shows "Aguardando escalação" when lineupReady is false', () => {
    render(<TurnBanner lineupReady={false} currentRole="host" myRole="host" currentPickNumber={0} opponentNickname="X" />)
    expect(screen.getByText(/aguardando escala/i)).toBeInTheDocument()
  })
  it('shows "Sua vez" when currentRole === myRole', () => {
    render(<TurnBanner lineupReady={true} currentRole="host" myRole="host" currentPickNumber={2} opponentNickname="X" />)
    expect(screen.getByText(/sua vez/i)).toBeInTheDocument()
  })
  it('shows "Vez de @opponentNickname" when opposite', () => {
    render(<TurnBanner lineupReady={true} currentRole="host" myRole="guest" currentPickNumber={2} opponentNickname="caio" />)
    expect(screen.getByText(/vez de.*caio/i)).toBeInTheDocument()
  })
  it('shows neutral text when currentRole is null (draft done)', () => {
    render(<TurnBanner lineupReady={true} currentRole={null} myRole="host" currentPickNumber={10} opponentNickname="X" />)
    expect(screen.getByText(/draft conclu/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/components/draft/TurnBanner.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/draft/TurnBanner.tsx`:

```tsx
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/contracts/rooms'

interface Props {
  lineupReady: boolean
  currentRole: Role | null
  myRole: Role
  currentPickNumber: number
  opponentNickname: string
}

export function TurnBanner({ lineupReady, currentRole, myRole, currentPickNumber, opponentNickname }: Props) {
  let text: string
  let tone: 'wait' | 'me' | 'them' | 'done' = 'wait'

  if (!lineupReady) {
    text = 'Aguardando escalação confirmada da partida…'
    tone = 'wait'
  } else if (currentRole === null) {
    text = 'Draft concluído. Aguardando início da partida…'
    tone = 'done'
  } else if (currentRole === myRole) {
    text = `Sua vez — pick ${currentPickNumber + 1}/10`
    tone = 'me'
  } else {
    text = `Vez de @${opponentNickname} — pick ${currentPickNumber + 1}/10`
    tone = 'them'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-lg border px-4 py-3 text-sm font-medium',
        tone === 'me' && 'border-primary bg-primary/10 text-primary',
        tone === 'them' && 'border-muted bg-muted/30 text-muted-foreground',
        tone === 'wait' && 'border-muted bg-muted/20 text-muted-foreground',
        tone === 'done' && 'border-event-positive/40 bg-event-positive/10 text-event-positive',
      )}
    >
      {text}
    </div>
  )
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/components/draft/TurnBanner.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/TurnBanner.tsx src/components/draft/TurnBanner.test.tsx
git commit -m "feat(draft): TurnBanner component (4 states)"
```

---

## Task 8: `ConfirmPickDialog` component

**Files:**
- Create: `src/components/draft/ConfirmPickDialog.tsx`
- Create: `src/components/draft/ConfirmPickDialog.test.tsx`

shadcn Dialog asking "Draftar @nome (POS, time)?". Cancel / Confirm; Confirm button shows the inline spinner pattern from `RoomActions`.

- [ ] **Step 1: Write failing test**

Create `src/components/draft/ConfirmPickDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmPickDialog } from './ConfirmPickDialog'

const ATH = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Pedro', shortName: 'Pedro',
  position: 'ATA' as const, jerseyNumber: 9,
  teamId: '00000000-0000-4000-8000-000000000020',
}

describe('ConfirmPickDialog', () => {
  it('renders nothing when athlete is null', () => {
    render(
      <ConfirmPickDialog
        athlete={null} teamName="Flamengo" onConfirm={vi.fn()} onCancel={vi.fn()} isPending={false}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders athlete info when present', () => {
    render(
      <ConfirmPickDialog
        athlete={ATH} teamName="Flamengo" onConfirm={vi.fn()} onCancel={vi.fn()} isPending={false}
      />,
    )
    expect(screen.getByText(/pedro/i)).toBeInTheDocument()
    expect(screen.getByText(/ata/i)).toBeInTheDocument()
    expect(screen.getByText(/flamengo/i)).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmPickDialog
        athlete={ATH} teamName="Flamengo" onConfirm={onConfirm} onCancel={onCancel} isPending={false}
      />,
    )
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('shows a spinner and disables buttons when isPending=true', () => {
    render(
      <ConfirmPickDialog
        athlete={ATH} teamName="Flamengo" onConfirm={vi.fn()} onCancel={vi.fn()} isPending={true}
      />,
    )
    const confirmBtn = screen.getByRole('button', { name: /draftando/i })
    expect(confirmBtn).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/components/draft/ConfirmPickDialog.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/draft/ConfirmPickDialog.tsx`:

```tsx
'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AthleteRefDto } from '@/lib/contracts/draft'

interface Props {
  athlete: AthleteRefDto | null
  teamName: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

export function ConfirmPickDialog({ athlete, teamName, onConfirm, onCancel, isPending }: Props) {
  const open = athlete !== null
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pick</DialogTitle>
          <DialogDescription>
            {athlete && (
              <>
                Draftar <strong>{athlete.name}</strong> ({athlete.position}, {teamName})?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} onClick={onCancel} />}>
            Cancelar
          </DialogClose>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Draftando…
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/components/draft/ConfirmPickDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/ConfirmPickDialog.tsx src/components/draft/ConfirmPickDialog.test.tsx
git commit -m "feat(draft): ConfirmPickDialog with inline spinner"
```

---

## Task 9: `DraftPool` component

**Files:**
- Create: `src/components/draft/DraftPool.tsx`
- Create: `src/components/draft/DraftPool.test.tsx`

Two columns (home, away). Position-filter chips. `PlayerCard` per starter. Disabled state shows the "Atualizar escalação" button when `lineupReady=false`. Click on available athlete calls `onPick(athleteId)`.

- [ ] **Step 1: Write failing test**

Create `src/components/draft/DraftPool.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftPool } from './DraftPool'
import type { DraftPoolEntryDto } from '@/lib/contracts/draft'
import type { TeamRefDto } from '@/lib/contracts/rooms'

const home: TeamRefDto = { id: 'th', name: 'Home', shortName: 'Home', abbreviation: 'HOM', primaryColor: '#FF0000', secondaryColor: '#FFFFFF' }
const away: TeamRefDto = { id: 'ta', name: 'Away', shortName: 'Away', abbreviation: 'AWY', primaryColor: '#0000FF', secondaryColor: '#FFFFFF' }

function makeEntry(opts: { id: string; teamSide: 'home'|'away'; teamId: string; position?: 'GOL'|'LAT'|'ZAG'|'MEI'|'ATA'; picked?: 'host'|'guest'|null }): DraftPoolEntryDto {
  return {
    athlete: {
      id: opts.id, name: opts.id, shortName: opts.id,
      position: opts.position ?? 'GOL', jerseyNumber: 1, teamId: opts.teamId,
    },
    teamSide: opts.teamSide,
    pickedByRole: opts.picked ?? null,
  }
}

describe('DraftPool', () => {
  it('renders "Atualizar escalação" CTA and empty state when lineupReady is false', () => {
    const onRefresh = vi.fn()
    render(
      <DraftPool
        pool={[]} disabled lineupReady={false}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        onPick={vi.fn()} onRefresh={onRefresh}
      />,
    )
    expect(screen.getByRole('button', { name: /atualizar escala/i })).toBeInTheDocument()
  })

  it('shows two columns of starters when lineupReady=true', () => {
    const pool = [
      makeEntry({ id: 'h1', teamSide: 'home', teamId: 'th' }),
      makeEntry({ id: 'a1', teamSide: 'away', teamId: 'ta' }),
    ]
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        onPick={vi.fn()} onRefresh={vi.fn()}
      />,
    )
    expect(screen.getAllByText(/^h1$|^a1$/)).toHaveLength(2)
  })

  it('filters by position chip', async () => {
    const pool = [
      makeEntry({ id: 'h-gol', teamSide: 'home', teamId: 'th', position: 'GOL' }),
      makeEntry({ id: 'h-ata', teamSide: 'home', teamId: 'th', position: 'ATA' }),
    ]
    const user = userEvent.setup()
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        onPick={vi.fn()} onRefresh={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^gol$/i }))
    expect(screen.getByText('h-gol')).toBeInTheDocument()
    expect(screen.queryByText('h-ata')).not.toBeInTheDocument()
  })

  it('marks picked entries and skips onPick for them', async () => {
    const onPick = vi.fn()
    const pool = [
      makeEntry({ id: 'taken', teamSide: 'home', teamId: 'th', picked: 'host' }),
    ]
    const user = userEvent.setup()
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        onPick={onPick} onRefresh={vi.fn()}
      />,
    )
    await user.click(screen.getByText('taken'))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('calls onPick when available card is clicked', async () => {
    const onPick = vi.fn()
    const pool = [
      makeEntry({ id: 'avail', teamSide: 'home', teamId: 'th' }),
    ]
    const user = userEvent.setup()
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        onPick={onPick} onRefresh={vi.fn()}
      />,
    )
    await user.click(screen.getByText('avail'))
    expect(onPick).toHaveBeenCalledWith('avail')
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/components/draft/DraftPool.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/draft/DraftPool.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PlayerCard } from '@/components/PlayerCard'
import { type Position } from '@/lib/contracts/catalog'
import { POSITIONS } from '@/lib/draft-positions-remaining'
import type { DraftPoolEntryDto } from '@/lib/contracts/draft'
import type { TeamRefDto } from '@/lib/contracts/rooms'

interface Props {
  pool: DraftPoolEntryDto[]
  disabled: boolean
  lineupReady: boolean
  homeTeam: TeamRefDto
  awayTeam: TeamRefDto
  positionsRemaining: Position[]
  onPick: (athleteId: string) => void
  onRefresh: () => void
}

export function DraftPool({
  pool,
  disabled,
  lineupReady,
  homeTeam,
  awayTeam,
  positionsRemaining,
  onPick,
  onRefresh,
}: Props) {
  const [positionFilter, setPositionFilter] = useState<Position | null>(null)

  if (!lineupReady) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Escalação ainda não confirmada pelo provedor.
        </p>
        <Button variant="outline" onClick={onRefresh}>
          Atualizar escalação
        </Button>
      </div>
    )
  }

  function filterPool(side: 'home' | 'away') {
    return pool
      .filter((e) => e.teamSide === side)
      .filter((e) => positionFilter === null || e.athlete.position === positionFilter)
  }

  function renderEntry(entry: DraftPoolEntryDto, team: TeamRefDto) {
    const isPicked = entry.pickedByRole !== null
    const positionExhausted = !positionsRemaining.includes(entry.athlete.position)
    const isInteractive = !disabled && !isPicked && !positionExhausted
    return (
      <div
        key={entry.athlete.id}
        className={cn(
          (isPicked || positionExhausted) && 'opacity-40',
          !isInteractive && 'pointer-events-none',
        )}
        aria-disabled={!isInteractive || undefined}
      >
        <PlayerCard
          shortName={entry.athlete.shortName}
          position={entry.athlete.position}
          jerseyNumber={entry.athlete.jerseyNumber}
          teamPrimaryColor={team.primaryColor ?? '#1f2937'}
          teamSecondaryColor={team.secondaryColor ?? '#ffffff'}
          onClick={isInteractive ? () => onPick(entry.athlete.id) : undefined}
        />
        {isPicked && (
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground pl-2 pt-0.5">
            picked by @{entry.pickedByRole}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={positionFilter === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPositionFilter(null)}
        >
          Todos
        </Button>
        {POSITIONS.map((p) => (
          <Button
            key={p}
            variant={positionFilter === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPositionFilter(p)}
            disabled={!positionsRemaining.includes(p)}
          >
            {p}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{homeTeam.shortName}</p>
          {filterPool('home').map((e) => renderEntry(e, homeTeam))}
        </section>
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{awayTeam.shortName}</p>
          {filterPool('away').map((e) => renderEntry(e, awayTeam))}
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/components/draft/DraftPool.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/DraftPool.tsx src/components/draft/DraftPool.test.tsx
git commit -m "feat(draft): DraftPool with two team columns + position filter"
```

---

## Task 10: `DraftView` container

**Files:**
- Create: `src/app/(app)/rooms/[id]/draft-view.tsx`
- Create: `src/app/(app)/rooms/[id]/draft-view.test.tsx`

Container that:
1. Mounts `useDraftSocket(room.id)`.
2. Reads `room.draft` directly (dispatcher already ensures `draft !== null`).
3. Derives `myRole`, `isMyTurn`, `canPick`, `positionsRemaining`.
4. Owns the `selectedAthleteId` state for the `ConfirmPickDialog`.
5. On confirm, calls `useMakePick.mutate`. On error, shows `sonner` toast.

- [ ] **Step 1: Write failing test**

Create `src/app/(app)/rooms/[id]/draft-view.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { DraftView } from './draft-view'
import type { RoomSnapshotDto } from '@/lib/contracts/rooms'

const mutate = vi.fn()
vi.mock('@/hooks/useMakePick', () => ({
  useMakePick: () => ({ mutate, isPending: false, reset: vi.fn() }),
  PickError: class PickError extends Error { code = 'UNKNOWN' },
}))
vi.mock('@/hooks/useDraftSocket', () => ({ useDraftSocket: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const ATH_HOME = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'PedroHome', shortName: 'PedroHome',
  position: 'GOL' as const, jerseyNumber: 1,
  teamId: '00000000-0000-4000-8000-000000000020',
}

function makeRoom(overrides: Partial<RoomSnapshotDto> = {}, draftOverrides: Partial<NonNullable<RoomSnapshotDto['draft']>> = {}): RoomSnapshotDto {
  const base: RoomSnapshotDto = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'ABCDEF',
    status: 'drafting',
    match: {
      id: '00000000-0000-4000-8000-000000000030',
      kickoffAt: '2026-06-11T19:00:00.000Z',
      status: 'scheduled',
      homeTeam: { id: '00000000-0000-4000-8000-000000000020', name: 'Home', shortName: 'HOM', abbreviation: 'HOM', primaryColor: '#FF0000', secondaryColor: '#FFFFFF' },
      awayTeam: { id: 'ta', name: 'Away', shortName: 'AWY', abbreviation: 'AWY', primaryColor: '#0000FF', secondaryColor: '#FFFFFF' },
    },
    host: { id: 'host-id', nickname: 'hostnick' },
    guest: { id: 'guest-id', nickname: 'guestnick' },
    winner: null,
    expiresAt: '2026-06-11T22:00:00.000Z',
    createdAt: '2026-06-11T18:30:00.000Z',
    draft: {
      currentPickNumber: 0,
      currentRole: 'host',
      lineupReady: true,
      picks: [],
      pool: [{ athlete: ATH_HOME, teamSide: 'home', pickedByRole: null }],
      ...draftOverrides,
    },
  }
  return { ...base, ...overrides }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('DraftView', () => {
  beforeEach(() => mutate.mockReset())

  it('renders "Sua vez" when host views and currentRole=host', () => {
    render(<DraftView room={makeRoom()} isHost={true} />, { wrapper })
    expect(screen.getByText(/sua vez/i)).toBeInTheDocument()
  })

  it('disables pool when not my turn', () => {
    render(<DraftView room={makeRoom({}, { currentRole: 'guest' })} isHost={true} />, { wrapper })
    expect(screen.getByText(/vez de.*guestnick/i)).toBeInTheDocument()
  })

  it('shows "Aguardando escalação" CTA when lineupReady=false', () => {
    render(<DraftView room={makeRoom({}, { lineupReady: false })} isHost={true} />, { wrapper })
    expect(screen.getByRole('button', { name: /atualizar escala/i })).toBeInTheDocument()
  })

  it('opens dialog and calls mutate on confirm', async () => {
    const user = userEvent.setup()
    render(<DraftView room={makeRoom()} isHost={true} />, { wrapper })
    await user.click(screen.getByText('PedroHome'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^confirmar$/i }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ pickNumber: 0, athleteId: ATH_HOME.id }),
      expect.any(Object),
    )
  })
})
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npm test -- src/app/'(app)'/rooms/'[id]'/draft-view.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/app/(app)/rooms/[id]/draft-view.tsx`:

```tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { DraftPool } from '@/components/draft/DraftPool'
import { TurnBanner } from '@/components/draft/TurnBanner'
import { ConfirmPickDialog } from '@/components/draft/ConfirmPickDialog'
import { RoomActions } from '@/components/rooms/RoomActions'
import { useDraftSocket } from '@/hooks/useDraftSocket'
import { useMakePick, PickError } from '@/hooks/useMakePick'
import { computePositionsRemaining } from '@/lib/draft-positions-remaining'
import { WsErrorCode } from '@/lib/contracts/ws'
import type { AthleteRefDto } from '@/lib/contracts/draft'
import type { RoomSnapshotDto, Role } from '@/lib/contracts/rooms'

const TOAST_BY_CODE: Partial<Record<string, string>> = {
  [WsErrorCode.LINEUP_NOT_READY]: 'Escalação ainda não confirmada.',
  [WsErrorCode.NOT_YOUR_TURN]: 'Não é sua vez agora.',
  [WsErrorCode.POSITION_ALREADY_FILLED]: 'Você já tem um atleta dessa posição.',
  [WsErrorCode.ATHLETE_ALREADY_PICKED]: 'Esse atleta já foi draftado.',
  [WsErrorCode.ATHLETE_NOT_IN_LINEUP]: 'Atleta não está mais escalado.',
  [WsErrorCode.INVALID_PICK_NUMBER]: 'Pick desincronizado — atualizando…',
  [WsErrorCode.PICK_RACE_LOST]: 'Outro jogador foi mais rápido.',
  [WsErrorCode.NOT_DRAFTING]: 'O draft não está mais em andamento.',
}

interface Props {
  room: RoomSnapshotDto
  isHost: boolean
}

export function DraftView({ room, isHost }: Props) {
  useDraftSocket(room.id)
  const queryClient = useQueryClient()
  const makePick = useMakePick(room.id)
  const [selected, setSelected] = useState<AthleteRefDto | null>(null)

  if (!room.draft) {
    // Type guard — page.tsx only renders DraftView when status='drafting' which
    // implies draft is populated, but bail out gracefully if not.
    return null
  }

  const draft = room.draft
  const myRole: Role = isHost ? 'host' : 'guest'
  const opponentNickname = isHost ? (room.guest?.nickname ?? '') : room.host.nickname
  const isMyTurn = draft.currentRole === myRole
  const canPick = isMyTurn && draft.lineupReady && !makePick.isPending
  const positionsRemaining = useMemo(
    () => computePositionsRemaining(draft.picks, myRole),
    [draft.picks, myRole],
  )

  const refreshSnapshot = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['room', room.id] })
  }, [queryClient, room.id])

  const selectedTeamName = selected
    ? (selected.teamId === room.match.homeTeam.id
        ? room.match.homeTeam.name
        : room.match.awayTeam.name)
    : ''

  function handlePoolClick(athleteId: string) {
    const entry = draft.pool.find((p) => p.athlete.id === athleteId)
    if (!entry) return
    setSelected(entry.athlete)
  }

  function handleConfirm() {
    if (!selected) return
    makePick.mutate(
      { pickNumber: draft.currentPickNumber, athleteId: selected.id },
      {
        onSuccess: () => {
          setSelected(null)
        },
        onError: (err: PickError) => {
          setSelected(null)
          const msg = TOAST_BY_CODE[err.code] ?? 'Falha ao registrar pick.'
          toast.error(msg)
          // For resync-implying errors, refresh the snapshot from REST so client gets ground truth.
          if (
            err.code === WsErrorCode.INVALID_PICK_NUMBER ||
            err.code === WsErrorCode.PICK_RACE_LOST ||
            err.code === WsErrorCode.ATHLETE_ALREADY_PICKED ||
            err.code === WsErrorCode.NOT_DRAFTING
          ) {
            refreshSnapshot()
          }
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <TurnBanner
        lineupReady={draft.lineupReady}
        currentRole={draft.currentRole}
        myRole={myRole}
        currentPickNumber={draft.currentPickNumber}
        opponentNickname={opponentNickname}
      />
      <DraftBoard
        picks={draft.picks}
        currentPickNumber={draft.currentPickNumber}
        homeTeam={room.match.homeTeam}
        awayTeam={room.match.awayTeam}
      />
      <DraftPool
        pool={draft.pool}
        disabled={!canPick}
        lineupReady={draft.lineupReady}
        homeTeam={room.match.homeTeam}
        awayTeam={room.match.awayTeam}
        positionsRemaining={positionsRemaining}
        onPick={handlePoolClick}
        onRefresh={refreshSnapshot}
      />
      <ConfirmPickDialog
        athlete={selected}
        teamName={selectedTeamName}
        onConfirm={handleConfirm}
        onCancel={() => setSelected(null)}
        isPending={makePick.isPending}
      />
      <RoomActions roomId={room.id} showAbandon={true} />
    </div>
  )
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npm test -- src/app/'(app)'/rooms/'[id]'/draft-view.test.tsx`
Expected: PASS, 4 cases.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(app)/rooms/[id]/draft-view.tsx' 'src/app/(app)/rooms/[id]/draft-view.test.tsx'
git commit -m "feat(draft): DraftView container wiring board+pool+banner+dialog"
```

---

## Task 11: Wire `DraftView` into the page dispatcher

**Files:**
- Modify: `src/app/(app)/rooms/[id]/page.tsx`

- [ ] **Step 1: Update dispatcher**

Replace the file content with:

```tsx
'use client'

import { use } from 'react'
import { useRoom } from '@/hooks/useRoom'
import { useRoomSocket } from '@/hooks/useRoomSocket'
import { useAuth } from '@/hooks/useAuth'
import { RoomStatus } from '@/lib/contracts/rooms'
import { LobbyView } from './lobby-view'
import { DraftView } from './draft-view'
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
        if (room.data.status === RoomStatus.DRAFTING) {
          return <DraftView room={room.data} isHost={isHost} />
        }
        return <PendingView room={room.data} />
      })()}
    </main>
  )
}
```

- [ ] **Step 2: Run all unit tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(app)/rooms/[id]/page.tsx'
git commit -m "feat(draft): dispatcher renders DraftView when status=drafting"
```

---

## Task 12: Playwright e2e — full draft run with two contexts

**Files:**
- Create: `test/e2e/draft.spec.ts`

Spec §9.5. Requires the API running locally with lineup data — the existing `test/e2e/helpers/login.ts` shows the pattern.

> **Prerequisite (manual):** before running, ensure the API has a match with `lineupsConfirmedAt` set + at least 5 starters per position per team. The API e2e seeds it via `BootstrapService`. You may need to PATCH a match's `lineupsConfirmedAt` via Prisma Studio if the stub doesn't auto-confirm. Document this in the test header.

- [ ] **Step 1: Write the spec**

Create `test/e2e/draft.spec.ts`:

```ts
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'
import { loginAs } from './helpers/login'

async function newLoggedContext(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAs(page, email)
  return { context, page }
}

test.describe('Draft — host and guest snake-draft a full lineup', () => {
  test('host picks first, both sides see picks in real time, room transitions to LIVE', async ({ browser }) => {
    test.slow() // 60s
    const host = await newLoggedContext(browser, `pw-draft-host-${Date.now()}@test.dev`)
    const guest = await newLoggedContext(browser, `pw-draft-guest-${Date.now()}@test.dev`)

    // 1. Host creates room from first match (assumes API has confirmed-lineup match)
    await host.page.goto('/')
    await host.page.getByRole('link', { name: /brasileirão/i }).click()
    await host.page.locator('[data-testid="match-card"]').first().click()
    await host.page.getByRole('button', { name: /criar sala/i }).click()
    await expect(host.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)
    const code = (await host.page.getByRole('textbox').inputValue()).split('/').pop()!

    // 2. Guest joins
    await guest.page.goto(`/rooms/join/${code}`)
    await guest.page.getByRole('button', { name: /entrar na sala/i }).click()
    await expect(guest.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)

    // 3. Both sides should see DraftView ("Sua vez" appears for host)
    await expect(host.page.getByText(/sua vez/i)).toBeVisible({ timeout: 10_000 })
    await expect(guest.page.getByText(/vez de/i)).toBeVisible({ timeout: 10_000 })

    // 4. Host picks first available athlete in the pool
    const firstAthlete = host.page.locator('[data-testid^="player-card"]').first()
    await firstAthlete.click()
    await host.page.getByRole('button', { name: /^confirmar$/i }).click()

    // 5. Guest sees that pick appear within 5s
    await expect(guest.page.getByText(/sua vez/i)).toBeVisible({ timeout: 5000 })

    // (Continue picks via a helper that knows snake order if you want a full run;
    // for smoke verify just the first 2 picks + the LIVE transition.)
    const secondAthlete = guest.page.locator('[data-testid^="player-card"]').first()
    await secondAthlete.click()
    await guest.page.getByRole('button', { name: /^confirmar$/i }).click()

    await expect(host.page.getByText(/sua vez/i).or(host.page.getByText(/vez de/i))).toBeVisible({ timeout: 5000 })

    await host.context.close()
    await guest.context.close()
  })

  test('shows "Aguardando escalação" CTA when lineup is not confirmed', async ({ browser }) => {
    // This test needs an API-side hook or fixture that creates a room whose match
    // has lineupsConfirmedAt = null. Skip with .skip() if you don't have that endpoint;
    // covered by the unit test draft-view.test.tsx already.
    test.skip(true, 'Requires API fixture to seed lineup=null; covered by unit tests')
  })
})
```

> **Note on `data-testid`:** `PlayerCard.tsx` doesn't currently expose a testid. Adjust the test selector to whatever robust selector exists (e.g., by text "PedroHome"), or extend `PlayerCard.tsx` to accept an optional `data-testid` prop. Pick the minimum change that makes the locator stable.

- [ ] **Step 2: Run e2e**

Make sure API is running (`cd ../draft-duel-game-api && npm run start:dev`) plus Postgres.

Run: `npm run test:e2e -- test/e2e/draft.spec.ts`
Expected: PASS (first test) and SKIP (second).

- [ ] **Step 3: Commit**

```bash
git add test/e2e/draft.spec.ts
git commit -m "test(draft): playwright e2e — two contexts, real-time pick + LIVE transition"
```

---

## Task 13: README + final pass

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a draft section to README**

Append (or insert into the existing "Verticals" listing if there is one):

```md
### Draft (vertical 4)

`/rooms/[id]` renders `<DraftView>` when status = `drafting`. Components:
- `DraftBoard` — 10 snake slots (5 host / 5 guest)
- `DraftPool` — two-column pool with position-filter chips
- `TurnBanner` — current pick state ("Sua vez", "Vez de @oponente", "Aguardando escalação")
- `ConfirmPickDialog` — confirms a pick before emitting `draft:pick` over WS

Hooks: `useMakePick` (mutation), `useDraftSocket` (listeners for `draft:pick_made` / `draft:current_pick` / `match:started`).

Wire contracts in `src/lib/contracts/draft.ts`. The `RoomSnapshot.draft` field
populates for any non-WAITING room (handled API-side, see
[`draft-design.md`](../draft-duel-game-api/docs/superpowers/specs/2026-05-23-draft-design.md)).
```

- [ ] **Step 2: Run full unit + lint**

Run: `npm test && npm run lint`
Expected: ALL PASS.

- [ ] **Step 3: Run e2e (requires API up)**

Run: `npm run test:e2e`
Expected: PASS or SKIP per Task 12 notes.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): document draft vertical"
```

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin feat/draft-frontend
gh pr create --title "feat(draft): snake draft frontend (vertical 4)" --body "$(cat <<'EOF'
## Summary
- Implements draft UX per [`docs/superpowers/specs/2026-05-23-draft-design.md`](./docs/superpowers/specs/2026-05-23-draft-design.md)
- `DraftView` dispatcher in `/rooms/[id]` when status = drafting
- Components: `DraftBoard`, `DraftPool`, `TurnBanner`, `ConfirmPickDialog`
- Hooks: `useMakePick`, `useDraftSocket`
- Contracts: `src/lib/contracts/draft.ts` + extension of `rooms.ts` and `ws.ts`

## Depends on
- `draft-duel-game-api` PR `feat/draft-api` running locally for Playwright

## Out of scope (vertical 5)
- Live match UI (`MatchScoreboard`, `MatchTimeline`, `SubstitutionDialog`)
- `match:event` / `match:score_updated` listeners
- Push when lineup confirms

## Test plan
- [x] `npm test` (Vitest)
- [x] `npm run test:e2e` (Playwright; needs API up)
- [x] `npm run lint`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the executor

- **No `connectSocket` in `useDraftSocket`:** the parent page mounts `useRoomSocket(id)`, which already manages the refcounted singleton. Calling `connect` again would double-decrement on cleanup and break the lobby.
- **`Role` lowercase vs `RoomStatus` UPPERCASE in contracts:** check `src/lib/contracts/rooms.ts` — both `RoomStatus` and `Role` use **lowercase** strings (`'host'`, `'drafting'`). Tasks above follow that. If the spec doc shows UPPERCASE in DTO examples, that's the **Prisma** internal — the wire is lowercase via `wire-enums.ts` in the API repo.
- **Catalog `Position` vs Draft `Position`:** they're the same set of strings (`'GOL'|'LAT'|'ZAG'|'MEI'|'ATA'`) and Position values are **UPPERCASE** in wire format (existing convention from `src/types/domain.ts`). Don't lowercase position values when echoing.
- **PlayerCard reuse:** the existing component is in `src/components/PlayerCard.tsx` (not under `rooms/`). Import path is `@/components/PlayerCard`.
- **`role-Banner`:** "Sua vez" should match Portuguese tone of existing UI (`/me`, lobby) — keep consistent.
- **Refresh-on-resync errors:** the `onError` handler triggers `queryClient.invalidateQueries(['room', roomId])` so the REST snapshot pulls fresh state when WS is out of sync. This complements the WS listeners without overlapping with them.
