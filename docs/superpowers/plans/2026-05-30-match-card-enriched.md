# Match Card Enriched — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the championship match listing with team form history (last 5 games), standings position, stadium name, and date-grouped layout.

**Architecture:** Three isolated changes — (1) expand the Zod contract to carry new fields, (2) update `MatchCard` to the Layout B design (richer team columns + venue), (3) update the championship page to group matches by day instead of filtering them.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Zod, Tailwind CSS, Vitest + Testing Library

---

## File Map

| File | Change |
|---|---|
| `src/lib/contracts/catalog.ts` | Add `matchTeamSummarySchema` / `MatchTeamSummaryDto`; update `matchSummarySchema` to use it + add `venue` |
| `src/lib/contracts/catalog.test.ts` | New tests for new schema; update existing fixture (missing new required fields) |
| `src/hooks/useCatalog.test.tsx` | Update `useMatch` fixture (team shape changed, `venue` required) |
| `src/components/MatchCard.tsx` | Richer `TeamBadge` with position + form badges; venue in center; `canceled` label |
| `src/components/MatchCard.test.tsx` | Update `baseTeam` fixture; new tests for position/form/venue/canceled |
| `src/app/championships/[slug]/page.tsx` | Remove filter; export `groupByDay`; add `DateGroup`; render day-grouped cards |
| `src/app/championships/[slug]/page.test.tsx` | New file — unit tests for `groupByDay` |

---

## Task 1: Expand catalog contract

**Files:**
- Modify: `src/lib/contracts/catalog.ts`
- Modify: `src/lib/contracts/catalog.test.ts`
- Modify: `src/hooks/useCatalog.test.tsx`

- [ ] **Step 1: Add new tests to `catalog.test.ts`**

Add `matchTeamSummarySchema` to the import line and add `validMatchTeamSummary` fixture + four new test cases inside the existing `describe('catalog contracts')` block:

```typescript
// At the top of the file, update imports:
import {
  championshipSchema,
  currentRoundSchema,
  matchLineupsSchema,
  matchSummarySchema,
  matchTeamSummarySchema,   // ← add this
  teamSchema,
} from './catalog'

// After validTeam declaration, add:
const validMatchTeamSummary = {
  ...validTeam,
  position: 1,
  form: ['V', 'V', 'E', 'D', 'V'] as Array<'V' | 'E' | 'D'>,
}
```

Add these four tests to `describe('catalog contracts')`:

```typescript
it('parses matchTeamSummarySchema with position and form', () => {
  const parsed = matchTeamSummarySchema.parse(validMatchTeamSummary)
  expect(parsed.position).toBe(1)
  expect(parsed.form).toEqual(['V', 'V', 'E', 'D', 'V'])
})

it('accepts null position in matchTeamSummarySchema (cup competition)', () => {
  const parsed = matchTeamSummarySchema.parse({ ...validMatchTeamSummary, position: null })
  expect(parsed.position).toBeNull()
})

it('parses match summary with venue and team context fields', () => {
  const parsed = matchSummarySchema.parse({
    id: '00000000-0000-4000-8000-000000000010',
    championshipId: '00000000-0000-4000-8000-000000000001',
    kickoffAt: '2026-05-20T18:00:00.000Z',
    status: 'scheduled',
    homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
    homeTeam: { ...validMatchTeamSummary },
    awayTeam: { ...validMatchTeamSummary, id: '00000000-0000-4000-8000-000000000021' },
    venue: 'Maracanã',
  })
  expect(parsed.venue).toBe('Maracanã')
  expect(parsed.homeTeam.position).toBe(1)
  expect(parsed.homeTeam.form).toEqual(['V', 'V', 'E', 'D', 'V'])
})

it('accepts null venue in match summary', () => {
  const parsed = matchSummarySchema.parse({
    id: '00000000-0000-4000-8000-000000000010',
    championshipId: '00000000-0000-4000-8000-000000000001',
    kickoffAt: '2026-05-20T18:00:00.000Z',
    status: 'scheduled',
    homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
    homeTeam: validMatchTeamSummary,
    awayTeam: { ...validMatchTeamSummary, id: '00000000-0000-4000-8000-000000000021' },
    venue: null,
  })
  expect(parsed.venue).toBeNull()
})

it('rejects invalid form values in matchTeamSummarySchema', () => {
  expect(() =>
    matchTeamSummarySchema.parse({ ...validMatchTeamSummary, form: ['X', 'V'] }),
  ).toThrow()
})
```

- [ ] **Step 2: Run tests — confirm new ones fail**

```bash
npx vitest run src/lib/contracts/catalog.test.ts
```

Expected: 5 new tests FAIL with "matchTeamSummarySchema is not exported" / schema validation errors. Existing tests still pass.

- [ ] **Step 3: Add `matchTeamSummarySchema` to `catalog.ts` and update `matchSummarySchema`**

In `src/lib/contracts/catalog.ts`, add after `teamSchema` declaration (line 29):

```typescript
export const matchTeamSummarySchema = teamSchema.extend({
  position: z.number().nullable(),
  form: z.array(z.enum(['V', 'E', 'D'])),
})
export type MatchTeamSummaryDto = z.infer<typeof matchTeamSummarySchema>
```

Then replace `matchSummarySchema` (currently lines 31–43) with:

```typescript
export const matchSummarySchema = z.object({
  id: z.string().uuid(),
  championshipId: z.string().uuid(),
  kickoffAt: z.string(),
  status: matchStatusSchema,
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  currentMinute: z.number().nullable(),
  lineupsConfirmedAt: z.string().nullable(),
  homeTeam: matchTeamSummarySchema,
  awayTeam: matchTeamSummarySchema,
  venue: z.string().nullable(),
})
export type MatchSummaryDto = z.infer<typeof matchSummarySchema>
```

- [ ] **Step 4: Update existing fixtures that are now missing required fields**

**In `catalog.test.ts`**, the `it('parses a match summary with both teams')` test passes teams without `position`/`form` and the match without `venue`. Update it:

```typescript
it('parses a match summary with both teams', () => {
  const parsed = matchSummarySchema.parse({
    id: '00000000-0000-4000-8000-000000000010',
    championshipId: '00000000-0000-4000-8000-000000000001',
    kickoffAt: '2026-05-20T18:00:00.000Z',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    currentMinute: null,
    lineupsConfirmedAt: null,
    homeTeam: {
      id: '00000000-0000-4000-8000-000000000020',
      name: 'A', shortName: 'A', abbreviation: 'AAA',
      imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
      position: null, form: [],
    },
    awayTeam: {
      id: '00000000-0000-4000-8000-000000000021',
      name: 'B', shortName: 'B', abbreviation: 'BBB',
      imageUrl: null, primaryColor: '#FF0000', secondaryColor: '#FFFFFF',
      position: null, form: [],
    },
    venue: null,
  })
  expect(parsed.status).toBe('scheduled')
})
```

**In `useCatalog.test.tsx`**, the `useMatch` test at line 69 passes teams without `position`/`form` and the match without `venue`. Update the `fetchMock` payload body:

```typescript
// Replace the existing fetchMock body for useMatch test with:
fetchMock.mockResolvedValueOnce(jsonResponse(200, {
  id: '00000000-0000-4000-8000-000000000010',
  championshipId: '00000000-0000-4000-8000-000000000001',
  kickoffAt: '2026-05-20T18:00:00.000Z',
  status: 'scheduled',
  homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
  homeTeam: { ...sampleTeam, position: null, form: [] },
  awayTeam: { ...sampleTeam, id: '00000000-0000-4000-8000-000000000021', name: 'B', abbreviation: 'BBB', position: null, form: [] },
  venue: null,
}))
```

- [ ] **Step 5: Run all catalog + hook tests — confirm all pass**

```bash
npx vitest run src/lib/contracts/catalog.test.ts src/hooks/useCatalog.test.tsx
```

Expected: all tests pass (0 failures).

- [ ] **Step 6: Commit**

```bash
git add src/lib/contracts/catalog.ts src/lib/contracts/catalog.test.ts src/hooks/useCatalog.test.tsx
git commit -m "feat(catalog): add MatchTeamSummaryDto with position/form and venue to match summary"
```

---

## Task 2: Enrich `MatchCard` with Layout B

**Files:**
- Modify: `src/components/MatchCard.tsx`
- Modify: `src/components/MatchCard.test.tsx`

- [ ] **Step 1: Update `MatchCard.test.tsx` — new fixture and new tests**

Replace the entire file content:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCard } from '@/components/MatchCard'
import type { MatchSummaryDto, MatchTeamSummaryDto } from '@/lib/contracts/catalog'

const baseTeam: MatchTeamSummaryDto = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
  position: null,
  form: [],
}

function makeMatch(overrides: Partial<MatchSummaryDto> = {}): MatchSummaryDto {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    championshipId: '00000000-0000-4000-8000-000000000001',
    kickoffAt: '2026-05-20T18:00:00.000Z',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    currentMinute: null,
    lineupsConfirmedAt: null,
    homeTeam: { ...baseTeam, abbreviation: 'AAA' },
    awayTeam: { ...baseTeam, id: '00000000-0000-4000-8000-000000000021', abbreviation: 'BBB' },
    venue: null,
    ...overrides,
  }
}

describe('MatchCard', () => {
  it('renders both team abbreviations and links to /matches/<id>', () => {
    render(<MatchCard match={makeMatch()} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/matches/00000000-0000-4000-8000-000000000010')
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

  it('labels postponed matches', () => {
    render(<MatchCard match={makeMatch({ status: 'postponed' })} />)
    expect(screen.getByText(/adiado/i)).toBeInTheDocument()
  })

  it('labels canceled matches', () => {
    render(<MatchCard match={makeMatch({ status: 'canceled' })} />)
    expect(screen.getByText(/cancelado/i)).toBeInTheDocument()
  })

  it('shows team position with trophy when position is not null', () => {
    render(
      <MatchCard match={makeMatch({ homeTeam: { ...baseTeam, abbreviation: 'AAA', position: 3 } })} />,
    )
    expect(screen.getByText(/3º lugar/)).toBeInTheDocument()
  })

  it('does not show position when null', () => {
    render(<MatchCard match={makeMatch()} />)
    expect(screen.queryByText(/lugar/)).not.toBeInTheDocument()
  })

  it('renders form badges when form is non-empty', () => {
    render(
      <MatchCard
        match={makeMatch({
          homeTeam: { ...baseTeam, abbreviation: 'AAA', form: ['V', 'E', 'D', 'V', 'V'] },
        })}
      />,
    )
    expect(screen.getAllByText('V').length).toBeGreaterThan(0)
    expect(screen.getByText('E')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('does not render form badges when form is empty', () => {
    render(<MatchCard match={makeMatch()} />)
    expect(screen.queryByText('V')).not.toBeInTheDocument()
    expect(screen.queryByText('E')).not.toBeInTheDocument()
    expect(screen.queryByText('D')).not.toBeInTheDocument()
  })

  it('shows venue when present', () => {
    render(<MatchCard match={makeMatch({ venue: 'Maracanã' })} />)
    expect(screen.getByText(/Maracanã/)).toBeInTheDocument()
  })

  it('does not show venue when null', () => {
    render(<MatchCard match={makeMatch({ venue: null })} />)
    expect(screen.queryByText(/Maracanã/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm new ones fail**

```bash
npx vitest run src/components/MatchCard.test.tsx
```

Expected: new tests for position/form/venue/canceled FAIL (component hasn't been updated yet). Existing tests may also fail due to TypeScript type mismatch on `baseTeam` (missing `position`/`form`).

- [ ] **Step 3: Rewrite `MatchCard.tsx`**

Replace the entire file content:

```typescript
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TeamIcon } from '@/components/TeamIcon'
import type { MatchSummaryDto, MatchTeamSummaryDto } from '@/lib/contracts/catalog'

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

const FORM_COLORS: Record<'V' | 'E' | 'D', string> = {
  V: 'bg-[#22c55e]',
  E: 'bg-[#eab308]',
  D: 'bg-[#ef4444]',
}

function TeamBadge({ team, align }: { team: MatchTeamSummaryDto; align: 'left' | 'right' }) {
  return (
    <div className={cn('flex flex-col gap-1', align === 'right' && 'items-end')}>
      <div
        className={cn('flex items-center gap-2 min-w-0', align === 'right' && 'flex-row-reverse')}
      >
        <TeamIcon
          size="md"
          imageUrl={team.imageUrl}
          primaryColor={team.primaryColor}
          secondaryColor={team.secondaryColor}
        />
        <span className="hidden sm:block text-sm font-semibold truncate">{team.shortName}</span>
        <span className="sm:hidden text-sm font-semibold tabular-nums">{team.abbreviation}</span>
      </div>
      {team.position !== null && (
        <span className="text-xs text-muted-foreground">
          🏆 {team.position}º lugar
        </span>
      )}
      {team.form.length > 0 && (
        <div className={cn('flex gap-0.5', align === 'right' && 'flex-row-reverse')}>
          {team.form.map((result, i) => (
            <span
              key={i}
              className={cn(
                'w-4 h-4 rounded-sm flex items-center justify-center text-[0.55rem] font-bold text-white',
                FORM_COLORS[result],
              )}
            >
              {result}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function MatchCard({ match, className }: MatchCardProps) {
  const showScore = match.status === 'live' || match.status === 'finished'

  return (
    <Link
      data-testid="match-card"
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
                : match.status === 'postponed'
                  ? 'Adiado'
                  : match.status === 'canceled'
                    ? 'Cancelado'
                    : ''}
          </span>
          {match.venue && (
            <span className="text-[0.6rem] text-muted-foreground/60 text-center leading-tight mt-0.5">
              🏟️ {match.venue}
            </span>
          )}
        </div>

        <TeamBadge team={match.awayTeam} align="right" />
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run src/components/MatchCard.test.tsx
```

Expected: all 12 tests pass (0 failures).

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchCard.tsx src/components/MatchCard.test.tsx
git commit -m "feat(match-card): layout B with team form, position, venue, and canceled label"
```

---

## Task 3: Group championship page by day

**Files:**
- Modify: `src/app/championships/[slug]/page.tsx`
- Create: `src/app/championships/[slug]/page.test.tsx`

- [ ] **Step 1: Create `page.test.tsx` with `groupByDay` tests**

Create the file `src/app/championships/[slug]/page.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest'
import { groupByDay } from './page'
import type { MatchSummaryDto } from '@/lib/contracts/catalog'

const baseTeam = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
  position: null, form: [] as Array<'V' | 'E' | 'D'>,
}

function makeMatch(id: string, kickoffAt: string): MatchSummaryDto {
  return {
    id,
    championshipId: '00000000-0000-4000-8000-000000000001',
    kickoffAt,
    status: 'scheduled',
    homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
    homeTeam: { ...baseTeam },
    awayTeam: { ...baseTeam, id: 'away-' + id },
    venue: null,
  }
}

describe('groupByDay', () => {
  it('returns empty array for no matches', () => {
    expect(groupByDay([])).toEqual([])
  })

  it('groups matches from the same local day together', () => {
    const matches = [
      makeMatch('1', '2026-05-31T16:00:00.000Z'),
      makeMatch('2', '2026-05-31T19:00:00.000Z'),
    ]
    const groups = groupByDay(matches)
    expect(groups).toHaveLength(1)
    expect(groups[0].matches).toHaveLength(2)
  })

  it('produces separate groups for different days', () => {
    const matches = [
      makeMatch('1', '2026-05-31T16:00:00.000Z'),
      makeMatch('2', '2026-06-01T19:00:00.000Z'),
    ]
    const groups = groupByDay(matches)
    expect(groups).toHaveLength(2)
  })

  it('sorts groups in ascending date order', () => {
    const matches = [
      makeMatch('2', '2026-06-01T19:00:00.000Z'),
      makeMatch('1', '2026-05-31T16:00:00.000Z'),
    ]
    const groups = groupByDay(matches)
    expect(groups[0].matches[0].id).toBe('1')
    expect(groups[1].matches[0].id).toBe('2')
  })

  it('sorts matches within a group in ascending kickoff order', () => {
    const matches = [
      makeMatch('2', '2026-05-31T19:00:00.000Z'),
      makeMatch('1', '2026-05-31T16:00:00.000Z'),
    ]
    const groups = groupByDay(matches)
    expect(groups[0].matches[0].id).toBe('1')
    expect(groups[0].matches[1].id).toBe('2')
  })

  it('each group has a non-empty label string', () => {
    const groups = groupByDay([makeMatch('1', '2026-05-31T16:00:00.000Z')])
    expect(groups[0].label).toBeTruthy()
    expect(typeof groups[0].label).toBe('string')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run 'src/app/championships/**'
```

Expected: all 6 tests FAIL with "groupByDay is not exported" or similar.

- [ ] **Step 3: Rewrite `page.tsx` with `groupByDay`, `formatDayLabel`, and `DateGroup`**

Replace the entire file content:

```typescript
'use client'

import Link from 'next/link'
import { type ReactNode, use } from 'react'
import { useCurrentRound } from '@/hooks/useCatalog'
import { MatchCard } from '@/components/MatchCard'
import type { MatchSummaryDto } from '@/lib/contracts/catalog'

export function groupByDay(
  matches: MatchSummaryDto[],
): Array<{ dateKey: string; label: string; matches: MatchSummaryDto[] }> {
  const map = new Map<string, MatchSummaryDto[]>()
  for (const match of matches) {
    const d = new Date(match.kickoffAt)
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(match)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayMatches]) => ({
      dateKey,
      label: formatDayLabel(dateKey),
      matches: [...dayMatches].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)),
    }))
}

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function DateGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1 pb-2 border-b border-border/40">
        {label}
      </h2>
      {children}
    </section>
  )
}

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
            <p className="text-muted-foreground text-sm">Sem partidas disponíveis nesta rodada.</p>
          ) : (
            <div className="space-y-8">
              {groupByDay(data.matches).map(({ dateKey, label, matches }) => (
                <DateGroup key={dateKey} label={label}>
                  {matches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </DateGroup>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run 'src/app/championships/**'
```

Expected: all 6 tests pass (0 failures).

- [ ] **Step 5: Run full test suite — confirm no regressions**

```bash
npx vitest run
```

Expected: all 188+ tests pass (0 failures).

- [ ] **Step 6: Commit**

```bash
git add src/app/championships/[slug]/page.tsx src/app/championships/[slug]/page.test.tsx
git commit -m "feat(championship-page): group matches by day with DateGroup, show all statuses"
```
