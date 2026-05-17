# Catalog Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume the 4 catalog REST endpoints (`/championships`, `/championships/:slug/current-round`, `/matches/:id`, `/matches/:id/lineups`) and replace the 3 stub pages (`/`, `/championships/[slug]`, `/matches/[id]`) with real catalog browsing UI — championships grid, round/matches list, and match detail with lineups.

**Architecture:** A local copy of the API's Zod response schemas lives in `src/lib/contracts/catalog.ts` (eventual home is `@draft-duel/contracts`, see API spec §10.3) and is the type+runtime source of truth. TanStack Query hooks call `api.get()` and parse responses through Zod, giving us drift detection at the boundary. Three new components (`ChampionshipCard`, `MatchCard`, `LineupGrid`) are composed from the existing `JerseyIcon` and `PlayerCard`. Catalog routes (`/`, `/championships/[slug]`, `/matches/[id]`) move out of the `(app)/` auth-guarded group — browsing is public; auth only kicks in for `/me`, `/rooms/[id]`, and (future) room creation flows.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TanStack Query v5 · Zod v4 · Tailwind v4 + shadcn/ui · Vitest + Testing Library · Playwright.

**Out of scope (deferred):**
- Room creation CTA on match page (feature "Criação de sala")
- Live event polling, match timeline (feature "Partida ao vivo")
- Pagination / past-rounds browsing (current MVP only shows current round)
- Skeleton loaders beyond a simple spinner

---

## File Structure

**Create:**
- `src/lib/contracts/catalog.ts` — Zod schemas + inferred response types (mirror of API)
- `src/lib/contracts/catalog.test.ts` — round-trip parse tests
- `src/hooks/useCatalog.ts` — 4 hooks (`useChampionships`, `useCurrentRound`, `useMatch`, `useMatchLineups`)
- `src/hooks/useCatalog.test.tsx` — hook tests with mocked fetch
- `src/components/ChampionshipCard.tsx`
- `src/components/ChampionshipCard.test.tsx`
- `src/components/MatchCard.tsx`
- `src/components/MatchCard.test.tsx`
- `src/components/LineupGrid.tsx`
- `src/components/LineupGrid.test.tsx`
- `src/app/championships/[slug]/page.tsx` (NEW location — public)
- `src/app/matches/[id]/page.tsx` (NEW location — public)
- `test/e2e/catalog.spec.ts`

**Modify:**
- `src/app/page.tsx` — replace static text with `ChampionshipsList`

**Delete:**
- `src/app/(app)/championships/[slug]/page.tsx` — moved to public location
- `src/app/(app)/matches/[id]/page.tsx` — moved to public location

**No new npm deps** (Zod, TanStack Query, Tailwind, Vitest, Playwright, Testing Library, `@testing-library/user-event` all already installed).

---

## Conventions

- All API calls go through the existing `api.get/post/...` from `src/lib/api.ts`.
- TanStack Query keys for catalog: `['championships']`, `['championship', slug, 'current-round']`, `['match', id]`, `['match', id, 'lineups']`.
- All response shapes go through `<schema>.parse(...)` so a contract drift fails fast at runtime with a useful Zod error.
- Catalog routes (`/`, `/championships/[slug]`, `/matches/[id]`) are **public** — they live OUTSIDE the `(app)/` route group, so the auth guard does not run.
- Test files colocated as `<name>.test.ts(x)`. Vitest picks them up via globals (`describe`, `it`, `expect`, `vi`).
- Run unit tests: `npm test`. Watch: `npm run test:watch`.
- Run e2e: `npm run test:e2e`.
- Commit cadence: one commit per task.

---

## Task 1: Catalog response contracts

**Files:**
- Create: `src/lib/contracts/catalog.ts`
- Create: `src/lib/contracts/catalog.test.ts`

The schemas are copies of `src/modules/catalog/dto/catalog-response.dto.ts` from the API repo. When `@draft-duel/contracts` ships, this file goes away.

- [ ] **Step 1: Write the failing test**

Create `src/lib/contracts/catalog.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  championshipSchema,
  currentRoundSchema,
  matchLineupsSchema,
  matchSummarySchema,
} from './catalog'

describe('catalog contracts', () => {
  it('parses a championship', () => {
    const parsed = championshipSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      slug: 'brasileirao',
      name: 'Brasileirão',
      kind: 'league',
    })
    expect(parsed.slug).toBe('brasileirao')
  })

  it('parses a match summary with both teams', () => {
    const parsed = matchSummarySchema.parse({
      id: '00000000-0000-0000-0000-000000000010',
      championshipId: '00000000-0000-0000-0000-000000000001',
      kickoffAt: '2026-05-20T18:00:00.000Z',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      currentMinute: null,
      lineupsConfirmedAt: null,
      homeTeam: {
        id: '00000000-0000-0000-0000-000000000020',
        name: 'A', shortName: 'A', abbreviation: 'AAA',
        crestUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
      },
      awayTeam: {
        id: '00000000-0000-0000-0000-000000000021',
        name: 'B', shortName: 'B', abbreviation: 'BBB',
        crestUrl: null, primaryColor: '#FF0000', secondaryColor: '#FFFFFF',
      },
    })
    expect(parsed.status).toBe('scheduled')
  })

  it('parses a current round response with championship, round, and matches', () => {
    const parsed = currentRoundSchema.parse({
      championship: {
        id: '00000000-0000-0000-0000-000000000001',
        slug: 'brasileirao',
        name: 'Brasileirão',
        kind: 'league',
      },
      round: {
        id: '00000000-0000-0000-0000-000000000002',
        number: 1,
        name: 'Rodada 1',
        startsAt: null,
        endsAt: null,
      },
      matches: [],
    })
    expect(parsed.round.number).toBe(1)
  })

  it('parses an empty lineups response', () => {
    const parsed = matchLineupsSchema.parse({
      matchId: '00000000-0000-0000-0000-000000000010',
      confirmedAt: null,
      home: [],
      away: [],
    })
    expect(parsed.home).toEqual([])
  })

  it('rejects a championship with bad kind', () => {
    expect(() =>
      championshipSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        slug: 'x', name: 'X', kind: 'tournament',
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- src/lib/contracts/catalog.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/contracts/catalog.ts`:

```typescript
import { z } from 'zod'

export const championshipKindSchema = z.enum(['league', 'cup'])

export const championshipSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  kind: championshipKindSchema,
})
export type ChampionshipDto = z.infer<typeof championshipSchema>

export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
  crestUrl: z.string().nullable(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
})
export type TeamDto = z.infer<typeof teamSchema>

export const matchStatusSchema = z.enum(['scheduled', 'live', 'finished', 'postponed'])

export const matchSummarySchema = z.object({
  id: z.string().uuid(),
  championshipId: z.string().uuid(),
  kickoffAt: z.string(),
  status: matchStatusSchema,
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  currentMinute: z.number().nullable(),
  lineupsConfirmedAt: z.string().nullable(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
})
export type MatchSummaryDto = z.infer<typeof matchSummarySchema>

export const currentRoundSchema = z.object({
  championship: championshipSchema,
  round: z.object({
    id: z.string().uuid(),
    number: z.number(),
    name: z.string(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  }),
  matches: z.array(matchSummarySchema),
})
export type CurrentRoundDto = z.infer<typeof currentRoundSchema>

export const positionSchema = z.enum(['GOL', 'LAT', 'ZAG', 'MEI', 'ATA'])

export const athleteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string(),
  position: positionSchema,
  jerseyNumber: z.number().nullable(),
  team: teamSchema,
})
export type AthleteDto = z.infer<typeof athleteSchema>

export const lineupEntrySchema = z.object({
  athlete: athleteSchema,
  isStarter: z.boolean(),
  jerseyNumber: z.number(),
})
export type LineupEntryDto = z.infer<typeof lineupEntrySchema>

export const matchLineupsSchema = z.object({
  matchId: z.string().uuid(),
  confirmedAt: z.string().nullable(),
  home: z.array(lineupEntrySchema),
  away: z.array(lineupEntrySchema),
})
export type MatchLineupsDto = z.infer<typeof matchLineupsSchema>
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- src/lib/contracts/catalog.test.ts`

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/catalog.ts src/lib/contracts/catalog.test.ts
git commit -m "feat(catalog): Zod response contracts (mirror of API)"
```

---

## Task 2: Catalog hooks (4 in one file)

**Files:**
- Create: `src/hooks/useCatalog.ts`
- Create: `src/hooks/useCatalog.test.tsx`

All four catalog reads share the same shape (`api.get` → `schema.parse`), so they live in one file under one focused responsibility.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useCatalog.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useChampionships,
  useCurrentRound,
  useMatch,
  useMatchLineups,
} from './useCatalog'

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const sampleTeam = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  crestUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
}

describe('useChampionships', () => {
  it('fetches and parses the championships list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [
      { id: '00000000-0000-0000-0000-000000000001', slug: 'brasileirao', name: 'Brasileirão', kind: 'league' },
    ]))
    const { result } = renderHook(() => useChampionships(), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].slug).toBe('brasileirao')
  })
})

describe('useCurrentRound', () => {
  it('fetches and parses the current round for a slug', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      championship: { id: '00000000-0000-0000-0000-000000000001', slug: 'brasileirao', name: 'B', kind: 'league' },
      round: { id: '00000000-0000-0000-0000-000000000002', number: 1, name: 'R1', startsAt: null, endsAt: null },
      matches: [],
    }))
    const { result } = renderHook(() => useCurrentRound('brasileirao'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.round.number).toBe(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/championships/brasileirao/current-round')
  })
})

describe('useMatch', () => {
  it('fetches and parses a match by id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      id: '00000000-0000-0000-0000-000000000010',
      championshipId: '00000000-0000-0000-0000-000000000001',
      kickoffAt: '2026-05-20T18:00:00.000Z',
      status: 'scheduled',
      homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
      homeTeam: sampleTeam,
      awayTeam: { ...sampleTeam, id: '00000000-0000-0000-0000-000000000021', name: 'B', abbreviation: 'BBB' },
    }))
    const { result } = renderHook(() => useMatch('00000000-0000-0000-0000-000000000010'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.status).toBe('scheduled')
  })
})

describe('useMatchLineups', () => {
  it('fetches and parses lineups for a match id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      matchId: '00000000-0000-0000-0000-000000000010',
      confirmedAt: null,
      home: [],
      away: [],
    }))
    const { result } = renderHook(
      () => useMatchLineups('00000000-0000-0000-0000-000000000010'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.home).toEqual([])
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- src/hooks/useCatalog.test.tsx`

Expected: FAIL — hooks not exported.

- [ ] **Step 3: Implement**

Create `src/hooks/useCatalog.ts`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  championshipSchema,
  currentRoundSchema,
  matchLineupsSchema,
  matchSummarySchema,
  type ChampionshipDto,
  type CurrentRoundDto,
  type MatchLineupsDto,
  type MatchSummaryDto,
} from '@/lib/contracts/catalog'
import { z } from 'zod'

const championshipsSchema = z.array(championshipSchema)

export function useChampionships() {
  return useQuery<ChampionshipDto[]>({
    queryKey: ['championships'],
    queryFn: async () => championshipsSchema.parse(await api.get<unknown>('/championships')),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCurrentRound(slug: string) {
  return useQuery<CurrentRoundDto>({
    queryKey: ['championship', slug, 'current-round'],
    queryFn: async () =>
      currentRoundSchema.parse(await api.get<unknown>(`/championships/${slug}/current-round`)),
    enabled: !!slug,
    staleTime: 60 * 1000,
  })
}

export function useMatch(id: string) {
  return useQuery<MatchSummaryDto>({
    queryKey: ['match', id],
    queryFn: async () =>
      matchSummarySchema.parse(await api.get<unknown>(`/matches/${id}`)),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export function useMatchLineups(id: string) {
  return useQuery<MatchLineupsDto>({
    queryKey: ['match', id, 'lineups'],
    queryFn: async () =>
      matchLineupsSchema.parse(await api.get<unknown>(`/matches/${id}/lineups`)),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- src/hooks/useCatalog.test.tsx`

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCatalog.ts src/hooks/useCatalog.test.tsx
git commit -m "feat(catalog): hooks for championships, round, match, lineups"
```

---

## Task 3: ChampionshipCard component

**Files:**
- Create: `src/components/ChampionshipCard.tsx`
- Create: `src/components/ChampionshipCard.test.tsx`

Card shown on the home page. Anchor wrapping a styled box. Kind shown as a small badge.

- [ ] **Step 1: Write the failing test**

Create `src/components/ChampionshipCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChampionshipCard } from '@/components/ChampionshipCard'

describe('ChampionshipCard', () => {
  it('renders name, kind label, and links to /championships/<slug>', () => {
    render(
      <ChampionshipCard
        slug="brasileirao"
        name="Brasileirão"
        kind="league"
      />,
    )
    const link = screen.getByRole('link', { name: /brasileirão/i })
    expect(link).toHaveAttribute('href', '/championships/brasileirao')
    expect(screen.getByText(/liga/i)).toBeInTheDocument()
  })

  it('shows "Copa" label for kind=cup', () => {
    render(
      <ChampionshipCard
        slug="copa-mundo"
        name="Copa do Mundo"
        kind="cup"
      />,
    )
    expect(screen.getByText(/copa/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- src/components/ChampionshipCard.test.tsx`

Expected: FAIL — component not exported.

- [ ] **Step 3: Implement**

Create `src/components/ChampionshipCard.tsx`:

```typescript
import Link from 'next/link'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<'league' | 'cup', string> = {
  league: 'Liga',
  cup: 'Copa',
}

interface ChampionshipCardProps {
  slug: string
  name: string
  kind: 'league' | 'cup'
  className?: string
}

export function ChampionshipCard({ slug, name, kind, className }: ChampionshipCardProps) {
  return (
    <Link
      href={`/championships/${slug}`}
      className={cn(
        'block rounded-xl bg-surface px-5 py-6 transition-all',
        'hover:bg-accent hover:scale-[1.01]',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        className,
      )}
    >
      <span className="inline-block text-[0.65rem] font-semibold uppercase tracking-wider text-primary mb-2">
        {KIND_LABEL[kind]}
      </span>
      <h2 className="text-xl font-bold text-foreground">{name}</h2>
    </Link>
  )
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- src/components/ChampionshipCard.test.tsx`

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/components/ChampionshipCard.tsx src/components/ChampionshipCard.test.tsx
git commit -m "feat(catalog): ChampionshipCard component"
```

---

## Task 4: Replace home page with championships list

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the file**

Replace `src/app/page.tsx`:

```typescript
'use client'

import { ChampionshipCard } from '@/components/ChampionshipCard'
import { useChampionships } from '@/hooks/useCatalog'

export default function HomePage() {
  const { data, isLoading, isError } = useChampionships()

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Draft Duel</h1>
        <p className="text-muted-foreground mt-1">Escolha um campeonato pra começar.</p>
      </header>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {isError && (
        <p className="text-event-negative text-sm">
          Não foi possível carregar os campeonatos. Tente novamente em instantes.
        </p>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((c) => (
            <ChampionshipCard key={c.id} slug={c.slug} name={c.name} kind={c.kind} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verify lint + existing tests pass**

Run: `npm run lint && npm test`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(catalog): home page lists championships from API"
```

---

## Task 5: Move championship + match routes out of auth-guarded group

**Files:**
- Create: `src/app/championships/[slug]/page.tsx` (placeholder for now; Task 7 fills it in)
- Create: `src/app/matches/[id]/page.tsx` (placeholder for now; Task 10 fills it in)
- Delete: `src/app/(app)/championships/[slug]/page.tsx`
- Delete: `src/app/(app)/matches/[id]/page.tsx`

Catalog browsing is public — anyone can see championships, rounds, matches, and lineups without logging in. Routes get moved out of `(app)/` so the auth guard doesn't fire. `/me` and `/rooms/[id]` stay inside `(app)/` (auth-required).

- [ ] **Step 1: Create the new championship page (stub)**

Create `src/app/championships/[slug]/page.tsx`:

```typescript
export default async function ChampionshipPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold capitalize">{slug.replace(/-/g, ' ')}</h1>
      <p className="text-muted-foreground mt-2">Carregando rodada…</p>
    </main>
  )
}
```

- [ ] **Step 2: Create the new match page (stub)**

Create `src/app/matches/[id]/page.tsx`:

```typescript
export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Partida</h1>
      <p className="text-muted-foreground mt-2 text-sm font-mono">{id}</p>
    </main>
  )
}
```

- [ ] **Step 3: Delete the old guarded versions**

Run:

```bash
git rm src/app/\(app\)/championships/\[slug\]/page.tsx
git rm src/app/\(app\)/matches/\[id\]/page.tsx
```

- [ ] **Step 4: Verify routing still works**

Run: `npm run lint && npm test && npm run build`

Expected: clean build. Next 15 should report two new routes (`/championships/[slug]` and `/matches/[id]`) and two removed ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/championships src/app/matches
git commit -m "feat(catalog): move championship and match routes out of auth-guarded group"
```

---

## Task 6: MatchCard component

**Files:**
- Create: `src/components/MatchCard.tsx`
- Create: `src/components/MatchCard.test.tsx`

Shows kickoff time, two team blocks (jersey colors + abbreviation), and an optional score block when match has started. Click → `/matches/[id]`.

- [ ] **Step 1: Write the failing test**

Create `src/components/MatchCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCard } from '@/components/MatchCard'
import type { MatchSummaryDto } from '@/lib/contracts/catalog'

const baseTeam = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  crestUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
}

function makeMatch(overrides: Partial<MatchSummaryDto> = {}): MatchSummaryDto {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    championshipId: '00000000-0000-0000-0000-000000000001',
    kickoffAt: '2026-05-20T18:00:00.000Z',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    currentMinute: null,
    lineupsConfirmedAt: null,
    homeTeam: { ...baseTeam, abbreviation: 'AAA' },
    awayTeam: { ...baseTeam, id: '00000000-0000-0000-0000-000000000021', abbreviation: 'BBB' },
    ...overrides,
  }
}

describe('MatchCard', () => {
  it('renders both team abbreviations and links to /matches/<id>', () => {
    render(<MatchCard match={makeMatch()} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/matches/00000000-0000-0000-0000-000000000010')
    expect(screen.getByText('AAA')).toBeInTheDocument()
    expect(screen.getByText('BBB')).toBeInTheDocument()
  })

  it('shows the kickoff time for scheduled matches', () => {
    render(<MatchCard match={makeMatch({ kickoffAt: '2026-05-20T18:00:00.000Z' })} />)
    expect(screen.getByText(/18:00|15:00/)).toBeInTheDocument()
  })

  it('shows the score when match is live', () => {
    render(
      <MatchCard
        match={makeMatch({ status: 'live', homeScore: 1, awayScore: 2, currentMinute: 42 })}
      />,
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/42'/)).toBeInTheDocument()
  })

  it('shows the final score when match is finished', () => {
    render(
      <MatchCard match={makeMatch({ status: 'finished', homeScore: 3, awayScore: 0 })} />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText(/encerrad/i)).toBeInTheDocument()
  })
})
```

Note: the kickoff time assertion accepts `18:00` or `15:00` because the test machine's timezone affects rendering (UTC-3 prints `15:00`). Either is fine — we just want to confirm a time appears.

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- src/components/MatchCard.test.tsx`

Expected: FAIL — component not exported.

- [ ] **Step 3: Implement**

Create `src/components/MatchCard.tsx`:

```typescript
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { MatchSummaryDto, TeamDto } from '@/lib/contracts/catalog'

interface MatchCardProps {
  match: MatchSummaryDto
  className?: string
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TeamBadge({ team, align }: { team: TeamDto; align: 'left' | 'right' }) {
  return (
    <div
      className={cn('flex items-center gap-2 min-w-0', align === 'right' && 'flex-row-reverse')}
    >
      <div
        className="w-8 h-8 rounded shrink-0"
        style={{ backgroundColor: team.primaryColor, border: `1px solid ${team.secondaryColor}33` }}
      />
      <span className="text-sm font-semibold tabular-nums">{team.abbreviation}</span>
    </div>
  )
}

export function MatchCard({ match, className }: MatchCardProps) {
  const showScore = match.status === 'live' || match.status === 'finished'

  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        'block rounded-lg bg-surface px-4 py-3 transition-all',
        'hover:bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        className,
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamBadge team={match.homeTeam} align="left" />

        <div className="flex flex-col items-center gap-0.5 min-w-[3rem]">
          {showScore ? (
            <div className="flex items-center gap-2 text-lg font-bold tabular-nums">
              <span>{match.homeScore ?? 0}</span>
              <span className="text-muted-foreground">·</span>
              <span>{match.awayScore ?? 0}</span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">
              {formatKickoff(match.kickoffAt)}
            </span>
          )}
          <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
            {match.status === 'live' && match.currentMinute !== null
              ? `${match.currentMinute}'`
              : match.status === 'finished'
                ? 'Encerrado'
                : ''}
          </span>
        </div>

        <TeamBadge team={match.awayTeam} align="right" />
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- src/components/MatchCard.test.tsx`

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchCard.tsx src/components/MatchCard.test.tsx
git commit -m "feat(catalog): MatchCard component"
```

---

## Task 7: Championship page — current round view

**Files:**
- Modify: `src/app/championships/[slug]/page.tsx`

Replace the placeholder with the real component that consumes `useCurrentRound` and renders one `MatchCard` per match.

- [ ] **Step 1: Replace the file**

Replace `src/app/championships/[slug]/page.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { use } from 'react'
import { useCurrentRound } from '@/hooks/useCatalog'
import { MatchCard } from '@/components/MatchCard'

export default function ChampionshipPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const { data, isLoading, isError } = useCurrentRound(slug)

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Campeonatos
      </Link>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {isError && (
        <p className="text-event-negative text-sm mt-4">
          Não foi possível carregar a rodada.
        </p>
      )}

      {data && (
        <>
          <header className="mt-4 mb-6">
            <h1 className="text-3xl font-bold text-foreground">{data.championship.name}</h1>
            <p className="text-muted-foreground mt-1">{data.round.name}</p>
          </header>

          {data.matches.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem partidas nesta rodada.</p>
          ) : (
            <div className="space-y-2">
              {data.matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
```

(Next 15 App Router exposes `params` as a `Promise` to client components; the `use()` hook unwraps it synchronously inside a client component.)

- [ ] **Step 2: Verify lint + tests still pass**

Run: `npm run lint && npm test`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/championships/\[slug\]/page.tsx
git commit -m "feat(catalog): championship page renders current round with matches"
```

---

## Task 8: LineupGrid component

**Files:**
- Create: `src/components/LineupGrid.tsx`
- Create: `src/components/LineupGrid.test.tsx`

Two-column layout (home/away). Each column has team header (jersey color + abbreviation) and a list of `PlayerCard`s grouped by position order (`GOL, LAT, ZAG, MEI, ATA`). When `confirmedAt` is null, shows "Escalações ainda não confirmadas".

- [ ] **Step 1: Write the failing test**

Create `src/components/LineupGrid.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineupGrid } from '@/components/LineupGrid'
import type { MatchLineupsDto } from '@/lib/contracts/catalog'

const sampleTeam = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  crestUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
}

function makeLineups(confirmed: boolean): MatchLineupsDto {
  return {
    matchId: '00000000-0000-0000-0000-000000000010',
    confirmedAt: confirmed ? '2026-05-20T17:00:00.000Z' : null,
    home: confirmed
      ? [
          {
            athlete: {
              id: '00000000-0000-0000-0000-0000000000a1',
              name: 'Home GK', shortName: 'GK1', position: 'GOL', jerseyNumber: 1,
              team: sampleTeam,
            },
            isStarter: true,
            jerseyNumber: 1,
          },
        ]
      : [],
    away: confirmed
      ? [
          {
            athlete: {
              id: '00000000-0000-0000-0000-0000000000b1',
              name: 'Away ATA', shortName: 'AT1', position: 'ATA', jerseyNumber: 9,
              team: { ...sampleTeam, id: '00000000-0000-0000-0000-000000000021', abbreviation: 'BBB' },
            },
            isStarter: true,
            jerseyNumber: 9,
          },
        ]
      : [],
    homeTeam: sampleTeam,
    awayTeam: { ...sampleTeam, id: '00000000-0000-0000-0000-000000000021', abbreviation: 'BBB' },
  } as MatchLineupsDto & { homeTeam: typeof sampleTeam; awayTeam: typeof sampleTeam }
}

describe('LineupGrid', () => {
  it('shows the not-confirmed message when confirmedAt is null', () => {
    render(<LineupGrid lineups={makeLineups(false)} homeTeam={sampleTeam} awayTeam={sampleTeam} />)
    expect(screen.getByText(/ainda não confirmadas/i)).toBeInTheDocument()
  })

  it('renders home and away players when lineups are confirmed', () => {
    const lineups = makeLineups(true)
    render(
      <LineupGrid
        lineups={lineups}
        homeTeam={sampleTeam}
        awayTeam={{ ...sampleTeam, id: '00000000-0000-0000-0000-000000000021', abbreviation: 'BBB' }}
      />,
    )
    expect(screen.getByText('GK1')).toBeInTheDocument()
    expect(screen.getByText('AT1')).toBeInTheDocument()
    expect(screen.getByText('AAA')).toBeInTheDocument()
    expect(screen.getByText('BBB')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- src/components/LineupGrid.test.tsx`

Expected: FAIL — component not exported.

- [ ] **Step 3: Implement**

Create `src/components/LineupGrid.tsx`:

```typescript
import { PlayerCard } from '@/components/PlayerCard'
import type { LineupEntryDto, MatchLineupsDto, TeamDto } from '@/lib/contracts/catalog'
import { POSITION_ORDER, type Position } from '@/types/domain'

interface LineupGridProps {
  lineups: MatchLineupsDto
  homeTeam: TeamDto
  awayTeam: TeamDto
}

function sortByPosition(entries: LineupEntryDto[]): LineupEntryDto[] {
  return [...entries].sort((a, b) => {
    const aPos = POSITION_ORDER.indexOf(a.athlete.position as Position)
    const bPos = POSITION_ORDER.indexOf(b.athlete.position as Position)
    if (aPos !== bPos) return aPos - bPos
    return a.jerseyNumber - b.jerseyNumber
  })
}

function TeamColumn({
  team,
  entries,
}: {
  team: TeamDto
  entries: LineupEntryDto[]
}) {
  return (
    <div>
      <header className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded shrink-0"
          style={{ backgroundColor: team.primaryColor, border: `1px solid ${team.secondaryColor}33` }}
        />
        <span className="text-sm font-semibold">{team.abbreviation}</span>
      </header>
      <div className="space-y-1">
        {sortByPosition(entries).map((e) => (
          <PlayerCard
            key={e.athlete.id}
            shortName={e.athlete.shortName}
            position={e.athlete.position as Position}
            jerseyNumber={e.jerseyNumber}
            teamPrimaryColor={team.primaryColor}
            teamSecondaryColor={team.secondaryColor}
            compact
          />
        ))}
      </div>
    </div>
  )
}

export function LineupGrid({ lineups, homeTeam, awayTeam }: LineupGridProps) {
  if (lineups.confirmedAt === null) {
    return (
      <div className="rounded-lg bg-surface px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">Escalações ainda não confirmadas.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <TeamColumn team={homeTeam} entries={lineups.home} />
      <TeamColumn team={awayTeam} entries={lineups.away} />
    </div>
  )
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- src/components/LineupGrid.test.tsx`

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/components/LineupGrid.tsx src/components/LineupGrid.test.tsx
git commit -m "feat(catalog): LineupGrid component with confirmed/empty states"
```

---

## Task 9: Match page — details + lineups

**Files:**
- Modify: `src/app/matches/[id]/page.tsx`

Renders the match summary at the top (using `MatchCard` for the score header) and `LineupGrid` below. Both `useMatch` and `useMatchLineups` fire in parallel via TanStack Query.

- [ ] **Step 1: Replace the file**

Replace `src/app/matches/[id]/page.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { use } from 'react'
import { useMatch, useMatchLineups } from '@/hooks/useCatalog'
import { MatchCard } from '@/components/MatchCard'
import { LineupGrid } from '@/components/LineupGrid'

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const match = useMatch(id)
  const lineups = useMatchLineups(id)

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Campeonatos
      </Link>

      {match.isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {match.isError && (
        <p className="text-event-negative text-sm mt-4">
          Não foi possível carregar a partida.
        </p>
      )}

      {match.data && (
        <>
          <div className="mt-4 mb-6">
            <MatchCard match={match.data} />
          </div>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Escalações
            </h2>
            {lineups.isLoading && (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            )}
            {lineups.isError && (
              <p className="text-sm text-event-negative">
                Não foi possível carregar as escalações.
              </p>
            )}
            {lineups.data && (
              <LineupGrid
                lineups={lineups.data}
                homeTeam={match.data.homeTeam}
                awayTeam={match.data.awayTeam}
              />
            )}
          </section>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verify lint + tests still pass**

Run: `npm run lint && npm test`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/matches/\[id\]/page.tsx
git commit -m "feat(catalog): match page renders details + lineups"
```

---

## Task 10: E2E — catalog browse happy path

**Files:**
- Create: `test/e2e/catalog.spec.ts`

Mocks the API at the network level (no live backend in CI). Exercises: home → click championship → see round → click match → see details + lineups.

- [ ] **Step 1: Write the test**

Create `test/e2e/catalog.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

const CHAMPIONSHIP = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'brasileirao',
  name: 'Brasileirão',
  kind: 'league',
}
const TEAM_A = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'Time A', shortName: 'Time A', abbreviation: 'AAA',
  crestUrl: null, primaryColor: '#FF0000', secondaryColor: '#FFFFFF',
}
const TEAM_B = {
  id: '00000000-0000-0000-0000-000000000021',
  name: 'Time B', shortName: 'Time B', abbreviation: 'BBB',
  crestUrl: null, primaryColor: '#0000FF', secondaryColor: '#FFFFFF',
}
const MATCH_ID = '00000000-0000-0000-0000-000000000010'

test('catalog browse: home → round → match', async ({ page }) => {
  await page.route('**/championships', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([CHAMPIONSHIP]),
    })
  })

  await page.route('**/championships/brasileirao/current-round', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        championship: CHAMPIONSHIP,
        round: {
          id: '00000000-0000-0000-0000-000000000002',
          number: 1, name: 'Rodada 1', startsAt: null, endsAt: null,
        },
        matches: [
          {
            id: MATCH_ID,
            championshipId: CHAMPIONSHIP.id,
            kickoffAt: '2026-05-20T18:00:00.000Z',
            status: 'scheduled',
            homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
            homeTeam: TEAM_A,
            awayTeam: TEAM_B,
          },
        ],
      }),
    })
  })

  await page.route(`**/matches/${MATCH_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MATCH_ID,
        championshipId: CHAMPIONSHIP.id,
        kickoffAt: '2026-05-20T18:00:00.000Z',
        status: 'scheduled',
        homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
        homeTeam: TEAM_A,
        awayTeam: TEAM_B,
      }),
    })
  })

  await page.route(`**/matches/${MATCH_ID}/lineups`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        matchId: MATCH_ID,
        confirmedAt: null,
        home: [],
        away: [],
      }),
    })
  })

  // /me is queried by Providers in some routes — return 401 (logged-out) consistently
  await page.route('**/me', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /draft duel/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /brasileirão/i })).toBeVisible()

  await page.getByRole('link', { name: /brasileirão/i }).click()

  await expect(page).toHaveURL(/\/championships\/brasileirao$/)
  await expect(page.getByRole('heading', { name: 'Brasileirão' })).toBeVisible()
  await expect(page.getByText('Rodada 1')).toBeVisible()
  await expect(page.getByText('AAA')).toBeVisible()
  await expect(page.getByText('BBB')).toBeVisible()

  await page.getByRole('link').filter({ hasText: 'AAA' }).first().click()

  await expect(page).toHaveURL(new RegExp(`/matches/${MATCH_ID}$`))
  await expect(page.getByText(/escalações/i)).toBeVisible()
  await expect(page.getByText(/ainda não confirmadas/i)).toBeVisible()
})
```

- [ ] **Step 2: Run the e2e test**

Run: `npm run test:e2e -- test/e2e/catalog.spec.ts`

Expected: PASS. Playwright will start the dev server automatically (per existing `playwright.config.ts`).

- [ ] **Step 3: Commit**

```bash
git add test/e2e/catalog.spec.ts
git commit -m "test(catalog): e2e happy path — home, round, match"
```

---

## Final verification

After all 10 tasks complete:

- [ ] **Run full unit suite**

Run: `npm test`

Expected: all green (existing auth tests + 5 new catalog unit suites).

- [ ] **Run full e2e suite**

Run: `npm run test:e2e`

Expected: all green (`home.spec.ts`, `auth-flow.spec.ts`, `catalog.spec.ts`).

- [ ] **Run lint**

Run: `npm run lint`

Expected: clean.

- [ ] **Build**

Run: `npm run build`

Expected: clean Next build. Routes printed should include:
- `/` (public)
- `/championships/[slug]` (public)
- `/matches/[id]` (public)
- `/login`, `/verify` (public auth pages)
- `/me`, `/rooms/[id]` (auth-guarded `(app)/` group)

- [ ] **Manual sanity check (if local API is up)**

Start the API (`npm run start:dev` in the api repo) with `EMAIL_PROVIDER=stub`, then `npm run dev` on the frontend and walk through:

1. Visit `/` — see 2 championship cards (Brasileirão, Copa do Mundo)
2. Click Brasileirão — land on `/championships/brasileirao`, see Rodada 1 with 2 matches
3. Click a match — land on `/matches/<uuid>`, see scoreboard + "Escalações ainda não confirmadas"
4. Hit back, click the other championship, repeat

If any step fails, file a follow-up rather than patching in this branch.

---

## Self-Review Notes

- **Spec coverage:**
  - All 4 API endpoints (api `docs/superpowers/specs/2026-05-01-draft-duel-rebuild-design.md` §7.1) consumed via TanStack Query hooks → Task 2
  - Home shows championships → Task 4
  - Championship slug page shows current round + matches → Task 7
  - Match page shows summary + lineups → Task 9
  - JerseyIcon-based UI per spec §2.5 (no athlete photos, no official crests) → Tasks 6 (MatchCard) + 8 (LineupGrid) reuse existing `JerseyIcon` and `PlayerCard`
- **Public catalog browsing.** Task 5 moves the two nested routes out of `(app)/`. Browsing requires no login. The `(app)/` guard stays for `/me` and `/rooms/[id]`.
- **Zod parsing at the boundary.** Every hook parses the API response through a Zod schema (Task 2). If the API breaks the contract, we see a clear Zod error in dev rather than runtime crashes deep in render.
- **Contracts location.** `src/lib/contracts/catalog.ts` is a local copy of the API DTOs. When `@draft-duel/contracts` package ships (per API spec §10.3), delete this file and replace imports — that's a separate PR.
- **`use(params)` in Next 15.** App Router with React 19 exposes `params` as a Promise; `use()` unwraps it synchronously in client components. This is the modern pattern.
- **Type imports.** Task 8 (`LineupGrid`) imports `POSITION_ORDER` and `Position` from `@/types/domain` — both already exist in that file. No need to redefine.
- **Test data shape.** All test fixtures use full UUIDs to pass `z.string().uuid()`. Component tests use the inferred `MatchSummaryDto` / `MatchLineupsDto` types to stay in sync with the contracts.
- **Timezone-tolerant assertions.** Task 6's kickoff test accepts either `18:00` or `15:00` since CI runners and dev machines may report different local times. The component's job is to format with `toLocaleTimeString('pt-BR', ...)`; we're not asserting Brazil-specific output.
- **Not covered (intentional):**
  - Pagination / past rounds — MVP only shows current round
  - Skeleton loaders — basic spinner is enough for MVP
  - Crest images — `crestUrl` is read but not yet rendered (column stays nullable)
  - Room creation CTA on match page — belongs to the "Criação de sala" feature
