# Melhorias de UI (campeonatos, partida, draft, ao vivo) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar 10 melhorias de interface no Draft Duel + 3 adições de backend que destravam dados que o frontend não tem hoje.

**Architecture:** Backend (`draft-duel-game-api`) ganha um endpoint de eventos por partida e dois campos extras em DTOs de sala. Frontend (`draft-duel-game-frontend`) ganha duas primitivas compartilhadas (`teamColors`, `actionIcons`), um hook (`useMatchEvents`), e mudanças por tela. Tudo segue os padrões existentes (NestJS + Zod DTOs no backend; Base UI + shadcn/ui + TanStack Query + contratos Zod no frontend).

**Tech Stack:** NestJS 11 / Prisma / Zod / Jest (backend); Next.js 15 / React 19 / TanStack Query / Base UI / Tailwind v4 / Vitest (frontend).

---

## Convenções de execução

- **Duas worktrees, dois repos:**
  - Frontend: `/workspace/repos/Duel Game/draft-duel-game-frontend/.worktrees/live-ui-improvements` (branch `feat/live-ui-improvements`) — **já existe**.
  - Backend: criar `/workspace/repos/Duel Game/draft-duel-game-api/.worktrees/match-events-and-room-dtos` (branch `feat/match-events-and-room-dtos`) na Fase 0.
- **Vitest (frontend) SEMPRE com `--pool=threads`** — o pool de forks padrão dá timeout por causa do espaço no path do repo ("Duel Game"). Ex: `npx vitest run --pool=threads <arquivo>`.
- **Backend usa Jest:** `npx jest <arquivo>`.
- Commits frequentes, um por tarefa concluída.
- Caminhos abaixo são relativos à raiz de cada worktree.

---

## Fase 0 — Backend (`draft-duel-game-api`)

### Task 0.0: Criar worktree do backend e baseline

- [ ] **Step 1: Criar a worktree**

```bash
cd "/workspace/repos/Duel Game/draft-duel-game-api"
git worktree add ".worktrees/match-events-and-room-dtos" -b "feat/match-events-and-room-dtos"
cd ".worktrees/match-events-and-room-dtos"
```

- [ ] **Step 2: Instalar deps e gerar Prisma client**

Run: `npm install && npx prisma generate`
Expected: instala sem erro; client gerado.

- [ ] **Step 3: Baseline de testes unitários**

Run: `npx jest src/modules/catalog src/modules/rooms`
Expected: PASS (suite verde). Se falhar, reportar antes de prosseguir.

---

### Task 0.1: B2 — `imageUrl` no `teamRef` do snapshot da sala

**Files:**
- Modify: `src/modules/rooms/dto/room-snapshot.dto.ts:7-14`
- Modify: `src/modules/rooms/room-mappers.ts:23-32`
- Test: `src/modules/rooms/room-mappers.spec.ts`

- [ ] **Step 1: Escrever teste falhando**

Em `room-mappers.spec.ts`, adicionar (dentro do describe de `toRoomSnapshot`, ajustando o builder de row conforme os helpers existentes no arquivo):

```ts
it('inclui imageUrl do time no snapshot', () => {
  const row = makeRoomRow() // helper existente no arquivo
  row.match.homeTeam.imageUrl = 'https://cdn/x.png'
  row.match.awayTeam.imageUrl = null
  const snap = toRoomSnapshot(row)
  expect(snap.match.homeTeam.imageUrl).toBe('https://cdn/x.png')
  expect(snap.match.awayTeam.imageUrl).toBeNull()
})
```

(Se não houver `makeRoomRow`, replicar o objeto `RoomWithRelations` usado nos testes vizinhos do mesmo arquivo.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/modules/rooms/room-mappers.spec.ts -t imageUrl`
Expected: FAIL (`imageUrl` undefined).

- [ ] **Step 3: Implementar**

Em `room-snapshot.dto.ts`, no `teamRefSchema`:

```ts
const teamRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
  imageUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
});
```

Em `room-mappers.ts`, no `toTeamRef`:

```ts
function toTeamRef(team: RoomWithRelations['match']['homeTeam']) {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    abbreviation: team.abbreviation,
    imageUrl: team.imageUrl,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/modules/rooms/room-mappers.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/rooms/dto/room-snapshot.dto.ts src/modules/rooms/room-mappers.ts src/modules/rooms/room-mappers.spec.ts
git commit -m "feat(rooms): expor imageUrl do time no snapshot da sala"
```

---

### Task 0.2: B3 — `match.id` no resumo de `/me/rooms`

**Files:**
- Modify: `src/modules/rooms/dto/room-summary.dto.ts:14-20`
- Modify: `src/modules/rooms/room-mappers.ts:93-109`
- Test: `src/modules/rooms/room-mappers.spec.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
it('inclui o id da partida no resumo da sala', () => {
  const row = makeRoomRow()
  row.match.id = '11111111-1111-1111-1111-111111111111'
  const summary = toRoomSummary(row, row.hostUserId)
  expect(summary.match.id).toBe('11111111-1111-1111-1111-111111111111')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/modules/rooms/room-mappers.spec.ts -t "id da partida"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `room-summary.dto.ts`:

```ts
  match: z.object({
    id: z.string().uuid(),
    kickoffAt: z.string().datetime(),
    status: z.enum(MATCH_STATUSES),
    homeTeam: teamRefSchema,
    awayTeam: teamRefSchema,
  }),
```

Em `room-mappers.ts`, no `toRoomSummary`, dentro de `match: {`:

```ts
    match: {
      id: row.match.id,
      kickoffAt: row.match.kickoffAt.toISOString(),
      status: toWireMatchStatus(row.match.status),
      homeTeam: toTeamRefSummary(row.match.homeTeam),
      awayTeam: toTeamRefSummary(row.match.awayTeam),
    },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/modules/rooms/room-mappers.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/rooms/dto/room-summary.dto.ts src/modules/rooms/room-mappers.ts src/modules/rooms/room-mappers.spec.ts
git commit -m "feat(rooms): incluir id da partida no resumo de /me/rooms"
```

---

### Task 0.3: B1 — `GET /matches/:id/events`

**Files:**
- Modify: `src/modules/catalog/dto/catalog-response.dto.ts` (adicionar schema de evento)
- Modify: `src/modules/catalog/catalog.mapper.ts` (adicionar `mapMatchEvent`)
- Modify: `src/modules/catalog/catalog.service.ts` (adicionar `getMatchEvents`)
- Modify: `src/modules/catalog/catalog.controller.ts` (nova rota)
- Test: `src/modules/catalog/catalog.service.spec.ts`

Nota: o enum Prisma `ActionType` tem valores idênticos às strings do wire (`GOAL`, `ASSIST`, …) e o código existente passa `action` direto, sem transformação. `MatchEvent` é global por partida (`matchId`), sem pontos.

- [ ] **Step 1: Adicionar o schema do evento ao DTO**

Em `catalog-response.dto.ts`, ao final, adicionar:

```ts
import { ACTION_TYPES } from '../../stats/stats-provider';
// (se ACTION_TYPES não existir lá, usar: const ACTION_TYPES = [...] espelhando o enum Prisma)

export const actionTypeSchema = z.enum(ACTION_TYPES);

export const matchEventResponseSchema = z.object({
  id: z.string().uuid(),
  athlete: athleteSchema.pick({
    id: true,
    name: true,
    shortName: true,
    position: true,
    jerseyNumber: true,
  }).extend({ teamId: z.string().uuid() }),
  action: actionTypeSchema,
  minute: z.number().int(),
  occurredAt: z.string(),
});
export type MatchEventResponse = z.infer<typeof matchEventResponseSchema>;

export const matchEventsResponseSchema = z.array(matchEventResponseSchema);
export type MatchEventsResponse = z.infer<typeof matchEventsResponseSchema>;
```

Verificar se `ACTION_TYPES` é exportado de `../../stats/stats-provider` (onde já vivem `MATCH_STATUSES`/`POSITIONS`). Se não, exportar lá um `ACTION_TYPES` espelhando o enum `ActionType` do Prisma (21 valores) e reusar.

- [ ] **Step 2: Escrever teste falhando do service**

Em `catalog.service.spec.ts`, adicionar (seguindo o padrão de mock do `prisma` já usado no arquivo):

```ts
it('getMatchEvents retorna eventos ordenados por minuto com teamId do atleta', async () => {
  prisma.match.findUnique.mockResolvedValue({ id: 'm-1' } as any)
  prisma.matchEvent.findMany.mockResolvedValue([
    { id: 'e1', action: 'GOAL', minute: 10, occurredAt: new Date('2026-05-31T20:10:00Z'),
      athlete: { id: 'a1', name: 'Fulano', shortName: 'Fulano', position: 'ATA', jerseyNumber: 9, teamId: 't1' } },
  ] as any)

  const res = await service.getMatchEvents('m-1')

  expect(prisma.matchEvent.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { matchId: 'm-1' }, orderBy: [{ minute: 'asc' }, { occurredAt: 'asc' }] }),
  )
  expect(res[0]).toEqual({
    id: 'e1', action: 'GOAL', minute: 10, occurredAt: '2026-05-31T20:10:00.000Z',
    athlete: { id: 'a1', name: 'Fulano', shortName: 'Fulano', position: 'ATA', jerseyNumber: 9, teamId: 't1' },
  })
})

it('getMatchEvents lança NotFound se a partida não existe', async () => {
  prisma.match.findUnique.mockResolvedValue(null)
  await expect(service.getMatchEvents('nope')).rejects.toThrow('Match not found')
})
```

Garantir que o mock do prisma no arquivo tenha `matchEvent: { findMany: jest.fn() }` (adicionar se faltar).

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/modules/catalog/catalog.service.spec.ts -t getMatchEvents`
Expected: FAIL (`service.getMatchEvents is not a function`).

- [ ] **Step 4: Implementar o mapper**

Em `catalog.mapper.ts`, adicionar:

```ts
import type { MatchEventResponse } from './dto/catalog-response.dto';

type MatchEventWithAthlete = Prisma.MatchEventGetPayload<{
  include: { athlete: true };
}>;

export function mapMatchEvent(e: MatchEventWithAthlete): MatchEventResponse {
  return {
    id: e.id,
    athlete: {
      id: e.athlete.id,
      name: e.athlete.name,
      shortName: e.athlete.shortName,
      position: e.athlete.position,
      jerseyNumber: e.athlete.jerseyNumber,
      teamId: e.athlete.teamId,
    },
    action: e.action,
    minute: e.minute,
    occurredAt: e.occurredAt.toISOString(),
  };
}
```

- [ ] **Step 5: Implementar o service**

Em `catalog.service.ts`, adicionar import de `mapMatchEvent` e `MatchEventsResponse`, e o método:

```ts
async getMatchEvents(id: string): Promise<MatchEventsResponse> {
  const match = await this.prisma.match.findUnique({ where: { id }, select: { id: true } });
  if (!match) throw new NotFoundException(`Match not found: ${id}`);

  const rows = await this.prisma.matchEvent.findMany({
    where: { matchId: id },
    include: { athlete: true },
    orderBy: [{ minute: 'asc' }, { occurredAt: 'asc' }],
  });
  return rows.map(mapMatchEvent);
}
```

- [ ] **Step 6: Implementar a rota**

Em `catalog.controller.ts`, importar `MatchEventsResponse` e adicionar:

```ts
@Get('/matches/:id/events')
async getMatchEvents(@Param('id', ParseUUIDPipe) id: string): Promise<MatchEventsResponse> {
  return this.service.getMatchEvents(id);
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx jest src/modules/catalog/catalog.service.spec.ts`
Expected: PASS.

- [ ] **Step 8: Build/lint**

Run: `npm run build && npm run lint`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/modules/catalog
git commit -m "feat(catalog): endpoint GET /matches/:id/events"
```

---

### Task 0.4: Fechar a fase de backend

- [ ] **Step 1: Suíte completa dos módulos tocados**

Run: `npx jest src/modules/catalog src/modules/rooms`
Expected: PASS.

- [ ] **Step 2: Abrir PR do backend (opcional, confirmar com o usuário)**

Não fazer push/PR sem o usuário pedir. Apenas deixar os commits na branch `feat/match-events-and-room-dtos`.

---

## Fase 1 — Frontend: contratos + primitivas

A partir daqui, trabalhar em `/workspace/repos/Duel Game/draft-duel-game-frontend/.worktrees/live-ui-improvements`.

### Task 1.0: Setup e baseline do frontend

- [ ] **Step 1: Instalar deps**

Run: `npm install`
Expected: ok.

- [ ] **Step 2: Baseline de testes**

Run: `npx vitest run --pool=threads`
Expected: PASS (verde). Se falhar, reportar antes de prosseguir.

---

### Task 1.1: Atualizar contratos de sala (espelhar B2/B3)

**Files:**
- Modify: `src/lib/contracts/rooms.ts:38-45` (`teamRefSchema`) e `:99-113` (`roomSummarySchema`)

- [ ] **Step 1: Editar o contrato**

Em `teamRefSchema` adicionar `imageUrl`:

```ts
const teamRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string(),
  imageUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
})
```

Em `roomSummarySchema.match` adicionar `id`:

```ts
  match: z.object({
    id: z.string().uuid(),
    kickoffAt: z.string(),
    status: matchStatusSchema,
    homeTeam: teamRefSummarySchema,
    awayTeam: teamRefSummarySchema,
  }),
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: pode acusar usos que agora exigem `imageUrl`/`id` — corrigir mocks de teste conforme forem aparecendo nas tarefas seguintes. Sem erros novos em código de produção.

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/rooms.ts
git commit -m "feat(contracts): imageUrl no teamRef e id no resumo de sala"
```

---

### Task 1.2: Primitiva `teamColors` (itens 2 e 5)

**Files:**
- Create: `src/lib/teamColors.ts`
- Test: `src/lib/teamColors.test.ts`

- [ ] **Step 1: Escrever testes falhando**

`src/lib/teamColors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { colorDistance, resolveMatchPalettes, paletteForSide, SAME_COLOR_THRESHOLD } from './teamColors'

describe('colorDistance', () => {
  it('é 0 para cores idênticas', () => {
    expect(colorDistance('#ff0000', '#ff0000')).toBe(0)
  })
  it('é grande para cores bem diferentes', () => {
    expect(colorDistance('#ff0000', '#0000ff')).toBeGreaterThan(SAME_COLOR_THRESHOLD)
  })
})

describe('resolveMatchPalettes', () => {
  it('inverte a paleta do visitante quando as primárias colidem', () => {
    const { home, away } = resolveMatchPalettes(
      { primaryColor: '#ff0000', secondaryColor: '#ffffff' },
      { primaryColor: '#ff0000', secondaryColor: '#000000' },
    )
    expect(home).toEqual({ primary: '#ff0000', secondary: '#ffffff' })
    expect(away).toEqual({ primary: '#000000', secondary: '#ff0000' })
  })
  it('não inverte quando as primárias são distintas', () => {
    const { away } = resolveMatchPalettes(
      { primaryColor: '#ff0000', secondaryColor: '#ffffff' },
      { primaryColor: '#0000ff', secondaryColor: '#ffff00' },
    )
    expect(away).toEqual({ primary: '#0000ff', secondary: '#ffff00' })
  })
  it('usa defaults neutros quando a cor é nula', () => {
    const { home } = resolveMatchPalettes(
      { primaryColor: null, secondaryColor: null },
      { primaryColor: '#0000ff', secondaryColor: '#ffff00' },
    )
    expect(home).toEqual({ primary: '#1f2937', secondary: '#ffffff' })
  })
})

describe('paletteForSide', () => {
  it('retorna a paleta certa por lado', () => {
    const palettes = { home: { primary: '#a', secondary: '#b' }, away: { primary: '#c', secondary: '#d' } }
    expect(paletteForSide(palettes, 'away')).toEqual({ primary: '#c', secondary: '#d' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/lib/teamColors.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/lib/teamColors.ts`:

```ts
/** Cores neutras quando o time não tem paleta configurada (iguais às de PlayerCard). */
const DEFAULT_PRIMARY = '#1f2937'
const DEFAULT_SECONDARY = '#ffffff'

/** Distância (redmean) abaixo da qual as primárias contam como "a mesma cor". Tunável. */
export const SAME_COLOR_THRESHOLD = 60

export interface Palette {
  primary: string
  secondary: string
}

interface TeamColorsInput {
  primaryColor: string | null
  secondaryColor: string | null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Aproximação perceptual barata (redmean). Faixa ~0..765. */
export function colorDistance(a: string, b: string): number {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return Number.POSITIVE_INFINITY
  const rmean = (ca.r + cb.r) / 2
  const dr = ca.r - cb.r
  const dg = ca.g - cb.g
  const db = ca.b - cb.b
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db,
  )
}

function withDefaults(t: TeamColorsInput): Palette {
  return {
    primary: t.primaryColor ?? DEFAULT_PRIMARY,
    secondary: t.secondaryColor ?? DEFAULT_SECONDARY,
  }
}

/**
 * Resolve as paletas de uma partida. Se as primárias de casa e fora forem muito
 * próximas, inverte primária<->secundária do time VISITANTE para diferenciá-lo.
 */
export function resolveMatchPalettes(
  home: TeamColorsInput,
  away: TeamColorsInput,
): { home: Palette; away: Palette } {
  const homePalette = withDefaults(home)
  let awayPalette = withDefaults(away)
  if (colorDistance(homePalette.primary, awayPalette.primary) < SAME_COLOR_THRESHOLD) {
    awayPalette = { primary: awayPalette.secondary, secondary: awayPalette.primary }
  }
  return { home: homePalette, away: awayPalette }
}

export function paletteForSide(
  palettes: { home: Palette; away: Palette },
  side: 'home' | 'away',
): Palette {
  return side === 'home' ? palettes.home : palettes.away
}

/** Mapeia um atleta (pelo teamId) ao lado home/away dado o id do time da casa. */
export function sideForTeamId(teamId: string, homeTeamId: string): 'home' | 'away' {
  return teamId === homeTeamId ? 'home' : 'away'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run --pool=threads src/lib/teamColors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teamColors.ts src/lib/teamColors.test.ts
git commit -m "feat(ui): primitiva teamColors com regra de inversão do visitante"
```

---

### Task 1.3: Primitiva `actionIcons` (item 10)

**Files:**
- Create: `src/lib/actionIcons.ts`
- Test: `src/lib/actionIcons.test.ts`

- [ ] **Step 1: Escrever teste falhando**

`src/lib/actionIcons.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ACTION_ICONS } from './actionIcons'
import { ACTION_TYPES } from '@/lib/contracts/live'

describe('ACTION_ICONS', () => {
  it('tem um ícone não-vazio para todos os ACTION_TYPES', () => {
    for (const t of ACTION_TYPES) {
      expect(ACTION_ICONS[t], `faltando ícone para ${t}`).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/lib/actionIcons.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/lib/actionIcons.ts`:

```ts
import type { ActionType } from '@/lib/contracts/live'

/** Emoji por tipo de ação, para as timelines de evento (glyphs podem ser afinados). */
export const ACTION_ICONS: Record<ActionType, string> = {
  GOAL: '⚽',
  ASSIST: '🅰️',
  YELLOW_CARD: '🟨',
  RED_CARD: '🟥',
  SAVE: '🧤',
  PENALTY_SAVE: '🧤',
  OWN_GOAL: '🥅',
  PENALTY_MISS: '❌',
  PENALTY_GOAL: '⚽',
  INTERCEPTION: '🤚',
  TACKLE_WON: '🛡️',
  KEY_PASS: '🎯',
  SHOT_ON_TARGET: '🎯',
  CLEAN_SHEET: '🔒',
  HARD_SAVE: '🧤',
  GOAL_CONCEDED: '🥅',
  POST_HIT: '🪧',
  MISSED_PASS: '↪️',
  FOUL_SUFFERED: '🤕',
  FOUL_COMMITTED: '⚠️',
  OFFSIDE: '🚩',
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run --pool=threads src/lib/actionIcons.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actionIcons.ts src/lib/actionIcons.test.ts
git commit -m "feat(ui): mapa de ícones por tipo de ação"
```

---

## Fase 2 — Frontend: hooks e dados

### Task 2.1: Contrato + hook `useMatchEvents` (item 3)

**Files:**
- Create: `src/lib/contracts/matchEvents.ts`
- Create: `src/hooks/useMatchEvents.ts`
- Test: `src/hooks/useMatchEvents.test.tsx`

- [ ] **Step 1: Criar o contrato**

`src/lib/contracts/matchEvents.ts`:

```ts
import { z } from 'zod'
import { actionTypeSchema } from './live'
import { positionSchema } from './catalog'

export const matchEventEntrySchema = z.object({
  id: z.string().uuid(),
  athlete: z.object({
    id: z.string().uuid(),
    name: z.string(),
    shortName: z.string(),
    position: positionSchema,
    jerseyNumber: z.number().int().nullable(),
    teamId: z.string().uuid(),
  }),
  action: actionTypeSchema,
  minute: z.number().int(),
  occurredAt: z.string(),
})
export type MatchEventEntryDto = z.infer<typeof matchEventEntrySchema>

export const matchEventsResponseSchema = z.array(matchEventEntrySchema)
export type MatchEventsResponseDto = z.infer<typeof matchEventsResponseSchema>
```

- [ ] **Step 2: Escrever teste falhando do hook**

`src/hooks/useMatchEvents.test.tsx` (espelhando o padrão de `useMyRooms.test.tsx`):

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMatchEvents } from './useMatchEvents'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMatchEvents', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('busca /matches/:id/events quando enabled', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([])
    const { result } = renderHook(() => useMatchEvents('m-1', true), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(api.get).toHaveBeenCalledWith('/matches/m-1/events')
  })

  it('não busca quando enabled=false', () => {
    renderHook(() => useMatchEvents('m-1', false), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/hooks/useMatchEvents.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implementar o hook**

`src/hooks/useMatchEvents.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { matchEventsResponseSchema, type MatchEventsResponseDto } from '@/lib/contracts/matchEvents'

export function useMatchEvents(id: string, enabled: boolean) {
  return useQuery<MatchEventsResponseDto>({
    queryKey: ['match', id, 'events'],
    queryFn: async () =>
      matchEventsResponseSchema.parse(await api.get(`/matches/${encodeURIComponent(id)}/events`)),
    enabled: !!id && enabled,
    staleTime: 30 * 1000,
  })
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run --pool=threads src/hooks/useMatchEvents.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contracts/matchEvents.ts src/hooks/useMatchEvents.ts src/hooks/useMatchEvents.test.tsx
git commit -m "feat(matches): hook useMatchEvents + contrato de eventos"
```

---

### Task 2.2: Selector de sala ativa por partida (item 4)

**Files:**
- Modify: `src/hooks/useMyRooms.ts` (adicionar opção `enabled`)
- Create: `src/lib/activeRoom.ts` (selector puro)
- Test: `src/lib/activeRoom.test.ts`
- Modify: `src/hooks/useMyRooms.test.tsx` (não quebrar — assinatura retrocompatível)

- [ ] **Step 1: Escrever teste falhando do selector**

`src/lib/activeRoom.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findActiveRoomForMatch } from './activeRoom'
import type { RoomSummaryDto } from '@/lib/contracts/rooms'

const room = (id: string, matchId: string): RoomSummaryDto => ({
  id,
  status: 'live',
  role: 'host',
  match: {
    id: matchId,
    kickoffAt: '2026-05-31T20:00:00.000Z',
    status: 'live',
    homeTeam: { name: 'A', shortName: 'A', abbreviation: 'A' },
    awayTeam: { name: 'B', shortName: 'B', abbreviation: 'B' },
  },
  opponent: null,
  winner: null,
  createdAt: '2026-05-31T19:00:00.000Z',
})

describe('findActiveRoomForMatch', () => {
  it('retorna a sala ativa da partida pedida', () => {
    const rooms = [room('r1', 'm-1'), room('r2', 'm-2')]
    expect(findActiveRoomForMatch(rooms, 'm-2')?.id).toBe('r2')
  })
  it('retorna null quando não há sala da partida', () => {
    expect(findActiveRoomForMatch([room('r1', 'm-1')], 'm-9')).toBeNull()
  })
  it('aceita undefined (dados ainda carregando)', () => {
    expect(findActiveRoomForMatch(undefined, 'm-1')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/lib/activeRoom.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar o selector**

`src/lib/activeRoom.ts`:

```ts
import type { RoomSummaryDto } from '@/lib/contracts/rooms'

export function findActiveRoomForMatch(
  rooms: RoomSummaryDto[] | undefined,
  matchId: string,
): RoomSummaryDto | null {
  return rooms?.find((r) => r.match.id === matchId) ?? null
}
```

- [ ] **Step 4: Tornar `useMyRooms` gateável por `enabled`**

Em `src/hooks/useMyRooms.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { myRoomsResponseSchema, type MyRoomsResponseDto } from '@/lib/contracts/rooms'

export function useMyRooms(
  filter?: 'active' | 'finished',
  options?: { enabled?: boolean },
) {
  const path = filter ? `/me/rooms?status=${filter}` : '/me/rooms'
  return useQuery<MyRoomsResponseDto>({
    queryKey: ['me', 'rooms', filter ?? 'all'],
    queryFn: async () => myRoomsResponseSchema.parse(await api.get(path)),
    enabled: options?.enabled ?? true,
  })
}
```

- [ ] **Step 5: Rodar testes (selector + hook existente)**

Run: `npx vitest run --pool=threads src/lib/activeRoom.test.ts src/hooks/useMyRooms.test.tsx`
Expected: PASS (os testes existentes de `useMyRooms` continuam verdes — `enabled` default é `true`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/activeRoom.ts src/lib/activeRoom.test.ts src/hooks/useMyRooms.ts
git commit -m "feat(matches): selector de sala ativa por partida + enabled em useMyRooms"
```

---

## Fase 3 — Frontend: UI por tela

### Task 3.1: `MatchCard` — destaque ao vivo (item 1) + inversão de cor (item 2)

**Files:**
- Modify: `src/components/MatchCard.tsx`
- Test: `src/components/MatchCard.test.tsx` (criar se não existir)

- [ ] **Step 1: Escrever teste falhando**

Verificar se `src/components/MatchCard.test.tsx` existe (`ls src/components/MatchCard.test.tsx`). Criar/estender com:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchCard } from './MatchCard'
import type { MatchSummaryDto } from '@/lib/contracts/catalog'

const team = (over: Partial<MatchSummaryDto['homeTeam']> = {}) => ({
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Casa', shortName: 'Casa',
  abbreviation: 'CAS', imageUrl: null, primaryColor: '#ff0000', secondaryColor: '#ffffff',
  position: null, form: [], ...over,
})

const base: MatchSummaryDto = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', championshipId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  kickoffAt: '2026-05-31T20:00:00.000Z', status: 'live', homeScore: 1, awayScore: 0,
  currentMinute: 73, lineupsConfirmedAt: null, venue: null,
  homeTeam: team(), awayTeam: team({ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Fora', shortName: 'Fora', abbreviation: 'FOR', primaryColor: '#ff0000', secondaryColor: '#000000' }),
}

describe('MatchCard ao vivo', () => {
  it('mostra um indicador de ao vivo com o minuto em destaque', () => {
    render(<MatchCard match={base} />)
    const live = screen.getByTestId('live-indicator')
    expect(live).toHaveTextContent("73'")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/components/MatchCard.test.tsx`
Expected: FAIL (sem `live-indicator`).

- [ ] **Step 3: Implementar — imports + paletas**

No topo de `MatchCard.tsx`, adicionar imports:

```ts
import { Radio } from 'lucide-react'
import { resolveMatchPalettes } from '@/lib/teamColors'
```

Em `TeamBadge`, trocar a assinatura para receber a paleta resolvida e usá-la no `TeamIcon`:

```tsx
function TeamBadge({
  team,
  align,
  palette,
}: {
  team: MatchTeamSummaryDto
  align: 'left' | 'right'
  palette: { primary: string; secondary: string }
}) {
  const alignRight = align === 'right'
  return (
    <div className={cn('flex flex-col gap-1 min-w-0', alignRight ? 'items-end' : 'items-start')}>
      <div className={cn('flex items-center gap-2 min-w-0', alignRight && 'flex-row-reverse')}>
        <TeamIcon
          size="md"
          imageUrl={team.imageUrl}
          primaryColor={palette.primary}
          secondaryColor={palette.secondary}
        />
        <span className="hidden sm:block text-sm font-semibold truncate">{team.shortName}</span>
        <span className="sm:hidden text-sm font-semibold tabular-nums">{team.abbreviation}</span>
      </div>
      {team.position !== null && (
        <span className="text-[0.65rem] text-muted-foreground tabular-nums">
          {alignRight ? `${team.position}º lugar 🏆` : `🏆 ${team.position}º lugar`}
        </span>
      )}
      {team.form.length > 0 && (
        <div className="flex gap-0.5">
          {team.form.map((result, i) => (
            <FormBadge key={i} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implementar — `MatchCard` usa paletas e indicador ao vivo**

Dentro de `MatchCard`, logo após o cálculo de `showScore`:

```tsx
const palettes = resolveMatchPalettes(match.homeTeam, match.awayTeam)
const isLive = match.status === 'live'
```

Trocar `<TeamBadge team={match.homeTeam} align="left" />` por `<TeamBadge team={match.homeTeam} align="left" palette={palettes.home} />` e o away por `palette={palettes.away}`.

Substituir o bloco do status (linhas ~104-119, o `<span>` com o minuto/`Encerrado`) por:

```tsx
{isLive && match.currentMinute !== null ? (
  <span
    data-testid="live-indicator"
    className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-wider text-event-positive"
  >
    <Radio size={11} className="animate-pulse" />
    {match.currentMinute}&apos;
  </span>
) : (
  <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
    {isPlayed
      ? 'Encerrado'
      : match.status === 'postponed'
        ? 'Adiado'
        : match.status === 'canceled'
          ? 'Cancelado'
          : ''}
  </span>
)}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run --pool=threads src/components/MatchCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `npx tsc --noEmit && npm run lint`
Expected: ok.

- [ ] **Step 7: Commit**

```bash
git add src/components/MatchCard.tsx src/components/MatchCard.test.tsx
git commit -m "feat(matches): indicador ao vivo + inversão de cor do visitante no card"
```

---

### Task 3.2: `LineupGrid` — inversão de cor (item 2/5 na lista de jogadores)

**Files:**
- Modify: `src/components/LineupGrid.tsx`

- [ ] **Step 1: Implementar**

No topo, importar:

```ts
import { resolveMatchPalettes } from '@/lib/teamColors'
```

Em `LineupGrid`, calcular paletas e passar a cada coluna:

```tsx
export function LineupGrid({ lineups, homeTeam, awayTeam }: LineupGridProps) {
  if (lineups.confirmedAt === null) {
    return (
      <div className="rounded-lg bg-surface px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">Nenhum jogador disponível ainda.</p>
      </div>
    )
  }
  const palettes = resolveMatchPalettes(homeTeam, awayTeam)
  return (
    <div className="grid grid-cols-2 gap-4">
      <TeamColumn team={homeTeam} entries={lineups.home} palette={palettes.home} />
      <TeamColumn team={awayTeam} entries={lineups.away} palette={palettes.away} />
    </div>
  )
}
```

Atualizar `TeamColumn` para receber `palette` e usá-la no `PlayerCard` (`teamPrimaryColor={palette.primary}`, `teamSecondaryColor={palette.secondary}`), mantendo o `TeamIcon` do header com as cores originais do time (o escudo do header não é o quadradinho do visitante da regra):

```tsx
function TeamColumn({
  team,
  entries,
  palette,
}: {
  team: TeamDto
  entries: LineupEntryDto[]
  palette: { primary: string; secondary: string }
}) {
  return (
    <div>
      <header className="flex items-center gap-2 mb-3">
        <TeamIcon size="sm" imageUrl={team.imageUrl} primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} />
        <span className="text-sm font-semibold">{team.abbreviation}</span>
      </header>
      <div className="space-y-1">
        {sortByPosition(entries).map((e) => (
          <PlayerCard
            key={e.athlete.id}
            shortName={e.athlete.shortName}
            position={e.athlete.position}
            jerseyNumber={e.jerseyNumber}
            teamPrimaryColor={palette.primary}
            teamSecondaryColor={palette.secondary}
            compact
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npx tsc --noEmit && npm run lint`
Expected: ok.

- [ ] **Step 3: Commit**

```bash
git add src/components/LineupGrid.tsx
git commit -m "feat(matches): aplicar inversão de cor na lista de jogadores"
```

---

### Task 3.3: Draft — cores via paleta resolvida (item 5)

**Files:**
- Modify: `src/components/draft/DraftPool.tsx`
- Modify: `src/components/draft/DraftBoard.tsx`

- [ ] **Step 1: `DraftPool` usa paletas resolvidas**

Importar `resolveMatchPalettes` e `type Palette` de `@/lib/teamColors`. No corpo (após o early-return de `!lineupReady`), calcular `const palettes = resolveMatchPalettes(homeTeam, awayTeam)`. Trocar a assinatura de `renderEntry` para receber a paleta e mudar o `PlayerCard`:

```tsx
function renderEntry(entry: DraftPoolEntryDto, palette: { primary: string; secondary: string }) {
  const isPicked = entry.pickedByRole !== null
  const positionExhausted = !positionsRemaining.includes(entry.athlete.position)
  const isInteractive = !disabled && !isPicked && !positionExhausted
  return (
    <div
      key={entry.athlete.id}
      className={cn((isPicked || positionExhausted) && 'opacity-40', !isInteractive && 'pointer-events-none')}
      aria-disabled={!isInteractive || undefined}
    >
      <PlayerCard
        shortName={entry.athlete.shortName}
        position={entry.athlete.position}
        jerseyNumber={entry.athlete.jerseyNumber}
        teamPrimaryColor={palette.primary}
        teamSecondaryColor={palette.secondary}
        onClick={isInteractive ? () => onPick(entry.athlete.id) : undefined}
      />
      {isPicked && (
        <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground pl-2 pt-0.5">
          picked by @{entry.pickedByRole === 'host' ? hostNickname : guestNickname}
        </p>
      )}
    </div>
  )
}
```

Nas duas seções de render, trocar `renderEntry(e, homeTeam)` → `renderEntry(e, palettes.home)` e `renderEntry(e, awayTeam)` → `renderEntry(e, palettes.away)`.

- [ ] **Step 2: `DraftBoard` usa paletas resolvidas**

Importar `resolveMatchPalettes`. Substituir `teamFor` (que devolve o time) por um `paletteFor` que devolve a paleta resolvida:

```tsx
const palettes = resolveMatchPalettes(homeTeam, awayTeam)
function paletteFor(pick: DraftPickDto) {
  return pick.athlete.teamId === homeTeam.id ? palettes.home : palettes.away
}
```

No `renderSlot`, trocar `const team = teamFor(pick)` por `const palette = paletteFor(pick)` e o `PlayerCard` para `teamPrimaryColor={palette.primary}` / `teamSecondaryColor={palette.secondary}`. Remover a função `teamFor` antiga e o `import type { TeamRefDto }` se ficar sem uso (manter se ainda usado nas props).

- [ ] **Step 3: Lint + typecheck**

Run: `npx tsc --noEmit && npm run lint`
Expected: ok.

- [ ] **Step 4: Rodar testes do draft (se houver)**

Run: `npx vitest run --pool=threads src/components/draft`
Expected: PASS (ou "no tests" — ok).

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/DraftPool.tsx src/components/draft/DraftBoard.tsx
git commit -m "feat(draft): cores dos atletas pela paleta do time com inversão"
```

---

### Task 3.4: `MatchHeader` — escudos (item 6) + responsivo mobile (item 8)

**Files:**
- Modify: `src/components/live/MatchHeader.tsx`
- Modify: `src/app/(app)/rooms/[id]/live-match-view.tsx` (passar times completos)
- Test: `src/components/live/MatchHeader.test.tsx` (criar)

- [ ] **Step 1: Escrever teste falhando**

`src/components/live/MatchHeader.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchHeader } from './MatchHeader'

const team = (over = {}) => ({
  id: 't1', name: 'Esquadrão', shortName: 'Esquadrão', abbreviation: 'ESQ',
  imageUrl: null, primaryColor: '#ff0000', secondaryColor: '#ffffff', ...over,
})

describe('MatchHeader', () => {
  it('mostra o ícone de ao vivo mas esconde o texto "AO VIVO" no mobile', () => {
    render(
      <MatchHeader homeTeam={team()} awayTeam={team({ id: 't2', abbreviation: 'PAL' })}
        homeScore={2} awayScore={1} matchStatus="live" minute={73} />,
    )
    // O texto "AO VIVO" existe mas com classe que o esconde no mobile (hidden sm:inline)
    const liveText = screen.getByText('AO VIVO')
    expect(liveText.className).toContain('hidden')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/components/live/MatchHeader.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `MatchHeader`**

Reescrever `src/components/live/MatchHeader.tsx`:

```tsx
import { Radio } from 'lucide-react'
import { TeamIcon } from '@/components/TeamIcon'
import type { MatchStatus } from '@/lib/contracts/live'

type Team = {
  id: string
  name: string
  shortName: string
  abbreviation: string
  imageUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

interface MatchHeaderProps {
  homeTeam: Team
  awayTeam: Team
  homeScore: number | null
  awayScore: number | null
  matchStatus: MatchStatus
  minute: number | null
}

function TeamSide({ team }: { team: Team }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <TeamIcon
        size="sm"
        imageUrl={team.imageUrl}
        primaryColor={team.primaryColor ?? '#1f2937'}
        secondaryColor={team.secondaryColor ?? '#ffffff'}
      />
      <span className="hidden sm:block font-bold text-lg truncate">{team.shortName}</span>
      <span className="sm:hidden font-bold text-base">{team.abbreviation}</span>
    </div>
  )
}

export function MatchHeader({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  matchStatus,
  minute,
}: MatchHeaderProps) {
  return (
    <div className="bg-surface rounded-lg p-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <TeamSide team={homeTeam} />
        <span className="text-2xl font-bold tabular-nums">{homeScore ?? '-'}</span>
        <span className="text-muted-foreground">×</span>
        <span className="text-2xl font-bold tabular-nums">{awayScore ?? '-'}</span>
        <TeamSide team={awayTeam} />
      </div>
      <div className="flex items-center gap-2 text-sm shrink-0">
        {matchStatus === 'live' && (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <Radio size={12} className="animate-pulse" />
            <span className="hidden sm:inline">AO VIVO</span>
          </span>
        )}
        {matchStatus === 'finished' && (
          <span className="text-muted-foreground font-semibold">FIM</span>
        )}
        <span className="tabular-nums text-muted-foreground">
          {minute !== null ? `${minute}'` : '--'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Passar times completos no `live-match-view`**

Em `live-match-view.tsx`, o `<MatchHeader ... />` já recebe `homeTeam={room.match.homeTeam}` e `awayTeam={room.match.awayTeam}`. Como `room.match.homeTeam` agora tem `imageUrl`/cores/abreviação (Task 1.1 + B2), nenhuma mudança de dados é necessária — apenas garantir que a chamada não está restringindo campos. Confirmar que continua `homeTeam={room.match.homeTeam}` (sem pick manual).

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run --pool=threads src/components/live/MatchHeader.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `npx tsc --noEmit && npm run lint`
Expected: ok.

- [ ] **Step 7: Commit**

```bash
git add src/components/live/MatchHeader.tsx src/components/live/MatchHeader.test.tsx src/app/\(app\)/rooms/\[id\]/live-match-view.tsx
git commit -m "feat(live): escudos no placar + header responsivo no mobile"
```

---

### Task 3.5: `TeamLineup` ao vivo — cores via paleta (item 5)

**Files:**
- Modify: `src/components/live/TeamLineup.tsx`
- Modify: `src/app/(app)/rooms/[id]/live-match-view.tsx` (passar paletas + homeTeamId)

- [ ] **Step 1: Implementar `TeamLineup`**

Atualizar props e o `JerseyIcon` (hoje `#666`/`#fff`). Passar as paletas resolvidas da partida e o id do time da casa; colorir cada atleta pelo seu `teamId`:

```tsx
import type { LineupSlot } from '@/lib/contracts/live'
import type { AthleteRefDto } from '@/lib/contracts/draft'
import { JerseyIcon } from '@/components/JerseyIcon'
import { POSITION_ORDER } from '@/types/domain'
import { cn } from '@/lib/utils'
import { paletteForSide, sideForTeamId, type Palette } from '@/lib/teamColors'

interface TeamLineupProps {
  title: string
  lineup: LineupSlot[]
  palettes: { home: Palette; away: Palette }
  homeTeamId: string
  subMode?: boolean
  selectedId?: string | null
  onSelectRemove?: (athlete: AthleteRefDto) => void
}

export function TeamLineup({
  title,
  lineup,
  palettes,
  homeTeamId,
  subMode = false,
  selectedId = null,
  onSelectRemove,
}: TeamLineupProps) {
  const sorted = [...lineup].sort(
    (a, b) => POSITION_ORDER.indexOf(a.athlete.position) - POSITION_ORDER.indexOf(b.athlete.position),
  )
  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      {sorted.map((slot) => {
        const palette = paletteForSide(palettes, sideForTeamId(slot.athlete.teamId, homeTeamId))
        return (
          <button
            key={slot.athlete.id}
            type="button"
            data-testid={`lineup-slot-${slot.athlete.id}`}
            disabled={!subMode}
            onClick={() => { if (subMode) onSelectRemove?.(slot.athlete) }}
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded bg-surface',
              selectedId === slot.athlete.id && 'ring-2 ring-primary',
              subMode ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
            )}
          >
            <JerseyIcon jerseyNumber={slot.athlete.jerseyNumber} primaryColor={palette.primary} secondaryColor={palette.secondary} size="sm" />
            <span className="flex-1 text-left text-sm font-medium truncate">{slot.athlete.shortName}</span>
            <span className="text-xs text-muted-foreground">{slot.athlete.position}</span>
            <span className="tabular-nums text-sm font-semibold">{slot.cumulativePoints.toFixed(1)}</span>
          </button>
        )
      })}
    </div>
  )
}
```

(Nota: adicionado `truncate` ao nome — ajuda no item 7.)

- [ ] **Step 2: Passar paletas no `live-match-view`**

Será feito junto com a Task 3.6 (reestruturação do layout), que calcula `palettes` uma vez e passa para ambos os `TeamLineup`.

- [ ] **Step 3: Commit (parcial — fechará junto com 3.6)**

Não commitar isolado se quebrar typecheck; seguir direto para a Task 3.6, que fornece as props faltantes, e commitar as duas juntas.

---

### Task 3.6: Layout A da tela ao vivo (item 7) + remoção do sub inline

**Files:**
- Modify: `src/app/(app)/rooms/[id]/live-match-view.tsx`

- [ ] **Step 1: Reestruturar o `live-match-view`**

Objetivo: header → cards de placar → duas escalações largas lado a lado → eventos full-width abaixo. A substituição passa a ser via modal (Task 3.7), então o `SubstitutionPanel` e o `subMode` inline saem do layout. Calcular `palettes` e `homeTeamId` e passar a ambos os `TeamLineup`.

Adicionar import:

```ts
import { resolveMatchPalettes } from '@/lib/teamColors'
```

Substituir o bloco de retorno principal (o `<div className="space-y-3">…</div>` final, a partir do `<MatchHeader/>`) por:

```tsx
  const palettes = resolveMatchPalettes(room.match.homeTeam, room.match.awayTeam)
  const homeTeamId = room.match.homeTeam.id

  return (
    <div className="space-y-3">
      <MatchHeader
        homeTeam={room.match.homeTeam}
        awayTeam={room.match.awayTeam}
        homeScore={live.homeScore}
        awayScore={live.awayScore}
        matchStatus={live.matchStatus}
        minute={interpolatedMinute}
      />
      <ScoreboardCards
        myName={myName}
        oppName={oppName}
        myScore={myScore}
        oppScore={oppScore}
        enableSubstitution={!finished}
        subMode={subMode}
        onToggleSub={handleToggleSub}
      />

      {finished && live.winner && (
        <FinishedBanner winner={live.winner} myRole={myRole} opponentNickname={opponentNickname} hadGuest={hadGuest} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TeamLineup title={myName} lineup={myLineup} palettes={palettes} homeTeamId={homeTeamId} />
        <TeamLineup title={oppName} lineup={oppLineup} palettes={palettes} homeTeamId={homeTeamId} />
      </div>

      <MatchTimeline events={live.recentEvents} />

      {subMode && !finished && (
        <SubstitutionModal
          open={subMode}
          lineup={myLineup}
          pool={live.pool}
          palettes={palettes}
          homeTeamId={homeTeamId}
          loading={makeSub.isPending}
          onClose={handleToggleSub}
          onConfirm={async (removeAthleteId, addAthleteId) => {
            try {
              await makeSub.mutateAsync({ removeAthleteId, addAthleteId })
              setSubMode(false)
            } catch (err: unknown) {
              const code = err instanceof SubstitutionError ? err.code : 'UNKNOWN'
              toast.error(TOAST_BY_CODE[code] ?? TOAST_BY_CODE.UNKNOWN!)
            }
          }}
        />
      )}
    </div>
  )
```

Remover os imports e estados que ficaram sem uso: `SubstitutionPanel`, `ConfirmSubDialog`, `selectedToRemove`, `pendingAddAthleteId`, `handlePickFromPool`, `cancelConfirm`, `confirmSub`, `addedAthleteForDialog`. Manter `subMode`/`handleToggleSub` (agora controlam a abertura da modal). Adicionar import de `SubstitutionModal` (criado na Task 3.7) e remover `import { useState }`-dependentes que sobraram conforme o typecheck apontar.

- [ ] **Step 2: Typecheck (vai falhar até a Task 3.7 existir)**

Run: `npx tsc --noEmit`
Expected: erro só por `SubstitutionModal` ainda não existir → seguir para a Task 3.7 e depois revalidar.

---

### Task 3.7: `SubstitutionModal` — modal de 3 passos (item 9)

**Files:**
- Create: `src/components/live/SubstitutionModal.tsx`
- Delete: `src/components/live/SubstitutionPanel.tsx`, `src/components/live/ConfirmSubDialog.tsx`
- Test: `src/components/live/SubstitutionModal.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

`src/components/live/SubstitutionModal.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubstitutionModal } from './SubstitutionModal'

const palettes = { home: { primary: '#a00', secondary: '#fff' }, away: { primary: '#00a', secondary: '#fff' } }
const athlete = (id: string, pos = 'ZAG') => ({ id, name: id, shortName: id, position: pos as any, jerseyNumber: 1, teamId: 't1' })

const lineup = [{ athlete: athlete('Leo'), cumulativePoints: 8 }]
const pool = [{ athlete: athlete('Murilo'), teamSide: 'home' as const, pointsSoFar: 5 }]

describe('SubstitutionModal', () => {
  it('caminha do passo 1 ao 3 e confirma', async () => {
    const onConfirm = vi.fn()
    render(
      <SubstitutionModal open lineup={lineup} pool={pool} palettes={palettes} homeTeamId="t1"
        loading={false} onClose={() => {}} onConfirm={onConfirm} />,
    )
    // Passo 1: escolher quem sai
    fireEvent.click(screen.getByText('Leo'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    // Passo 2: escolher quem entra
    fireEvent.click(screen.getByText('Murilo'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    // Passo 3: confirmar
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith('Leo', 'Murilo')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/components/live/SubstitutionModal.test.tsx`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar a modal**

`src/components/live/SubstitutionModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { JerseyIcon } from '@/components/JerseyIcon'
import { cn } from '@/lib/utils'
import type { LineupSlot, LiveSubPoolEntry } from '@/lib/contracts/live'
import { paletteForSide, sideForTeamId, type Palette } from '@/lib/teamColors'

interface Props {
  open: boolean
  lineup: LineupSlot[]
  pool: LiveSubPoolEntry[]
  palettes: { home: Palette; away: Palette }
  homeTeamId: string
  loading: boolean
  onClose: () => void
  onConfirm: (removeAthleteId: string, addAthleteId: string) => void
}

export function SubstitutionModal({
  open,
  lineup,
  pool,
  palettes,
  homeTeamId,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [addId, setAddId] = useState<string | null>(null)

  const removed = lineup.find((s) => s.athlete.id === removeId)?.athlete ?? null
  const candidates = removed ? pool.filter((p) => p.athlete.position === removed.position) : []
  const added = pool.find((p) => p.athlete.id === addId)?.athlete ?? null

  const reset = () => { setStep(1); setRemoveId(null); setAddId(null) }
  const close = () => { reset(); onClose() }

  const palette = (teamId: string) => paletteForSide(palettes, sideForTeamId(teamId, homeTeamId))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Substituir jogador</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1" aria-label={`Passo ${step} de 3`}>
          <Stepper step={step} />
          <span>
            {step === 1 ? 'Passo 1 de 3 · Quem sai?' : step === 2 ? 'Passo 2 de 3 · Quem entra?' : 'Passo 3 de 3 · Confirmar'}
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-1.5">
            {lineup.map((slot) => (
              <Row
                key={slot.athlete.id}
                label={slot.athlete.shortName}
                position={slot.athlete.position}
                points={slot.cumulativePoints}
                palette={palette(slot.athlete.teamId)}
                selected={removeId === slot.athlete.id}
                onClick={() => setRemoveId(slot.athlete.id)}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-1.5">
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">Nenhum jogador disponível para essa posição.</p>
            ) : (
              candidates.map((entry) => (
                <Row
                  key={entry.athlete.id}
                  label={entry.athlete.shortName}
                  position={entry.athlete.position}
                  points={entry.pointsSoFar}
                  palette={palette(entry.athlete.teamId)}
                  selected={addId === entry.athlete.id}
                  onClick={() => setAddId(entry.athlete.id)}
                />
              ))
            )}
          </div>
        )}

        {step === 3 && removed && added && (
          <div className="space-y-2 py-2 text-center text-sm">
            <p><strong>{removed.shortName}</strong> ({removed.position}) <span className="text-event-negative">↓ sai</span></p>
            <p className="text-muted-foreground">↓</p>
            <p><strong>{added.shortName}</strong> ({added.position}) <span className="text-event-positive">↑ entra</span></p>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button variant="outline" onClick={close} disabled={loading}>Cancelar</Button>
          ) : (
            <Button variant="outline" onClick={() => setStep((s) => (s === 3 ? 2 : 1))} disabled={loading}>← Voltar</Button>
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!removeId}>Próximo →</Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!addId}>Próximo →</Button>
          )}
          {step === 3 && (
            <Button onClick={() => removeId && addId && onConfirm(removeId, addId)} disabled={loading || !removeId || !addId}>
              {loading ? 'Confirmando...' : 'Confirmar substituição'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold',
            n < step ? 'bg-event-positive/20 text-event-positive' : n === step ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
          )}
        >
          {n < step ? '✓' : n}
        </span>
      ))}
    </span>
  )
}

function Row({
  label,
  position,
  points,
  palette,
  selected,
  onClick,
}: {
  label: string
  position: string
  points: number
  palette: Palette
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 p-2 rounded bg-surface hover:bg-accent text-left',
        selected && 'ring-2 ring-primary',
      )}
    >
      <span className="px-1.5 py-0.5 text-[0.6rem] font-semibold rounded bg-secondary text-muted-foreground uppercase">{position}</span>
      <JerseyIcon primaryColor={palette.primary} secondaryColor={palette.secondary} size="sm" />
      <span className="flex-1 text-sm font-medium truncate">{label}</span>
      <span className="tabular-nums text-sm text-muted-foreground">{points.toFixed(1)}</span>
    </button>
  )
}
```

- [ ] **Step 4: Apagar componentes antigos**

```bash
git rm src/components/live/SubstitutionPanel.tsx src/components/live/ConfirmSubDialog.tsx
```

(Se houver testes referenciando esses arquivos, removê-los também.)

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run --pool=threads src/components/live/SubstitutionModal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint do conjunto live (3.5–3.7)**

Run: `npx tsc --noEmit && npm run lint`
Expected: ok (todas as props de `TeamLineup` e `SubstitutionModal` agora batem com o `live-match-view`).

- [ ] **Step 7: Rodar testes da tela ao vivo**

Run: `npx vitest run --pool=threads src/components/live src/app`
Expected: PASS. Ajustar quaisquer testes que ainda referenciem o fluxo de sub inline antigo.

- [ ] **Step 8: Commit (fecha 3.5 + 3.6 + 3.7)**

```bash
git add -A src/components/live src/app/\(app\)/rooms/\[id\]/live-match-view.tsx
git commit -m "feat(live): layout A (eventos full-width), cores dos atletas e modal de substituição em 3 passos"
```

---

### Task 3.8: Ícones na timeline ao vivo (item 10)

**Files:**
- Modify: `src/components/live/MatchTimeline.tsx`

- [ ] **Step 1: Implementar**

Importar `ACTION_ICONS` e adicionar o ícone antes do minuto. No topo:

```ts
import { ACTION_ICONS } from '@/lib/actionIcons'
```

Dentro do `.map`, antes do `<span>` do minuto, adicionar:

```tsx
<span aria-hidden className="text-base leading-none">{ACTION_ICONS[evt.action]}</span>
```

- [ ] **Step 2: Lint + testes da timeline**

Run: `npx tsc --noEmit && npx vitest run --pool=threads src/components/live`
Expected: ok/PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/live/MatchTimeline.tsx
git commit -m "feat(live): ícones por tipo de ação na timeline"
```

---

### Task 3.9: Tela `/matches/[id]` — eventos quando ao vivo/encerrada (item 3) + voltar pra sala (item 4)

**Files:**
- Create: `src/components/MatchEventsTimeline.tsx`
- Modify: `src/app/matches/[id]/page.tsx`
- Test: `src/components/MatchEventsTimeline.test.tsx`

- [ ] **Step 1: Escrever teste falhando do componente de timeline**

`src/components/MatchEventsTimeline.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchEventsTimeline } from './MatchEventsTimeline'
import type { MatchEventEntryDto } from '@/lib/contracts/matchEvents'

const ev = (id: string, action: MatchEventEntryDto['action'], minute: number): MatchEventEntryDto => ({
  id, action, minute, occurredAt: '2026-05-31T20:10:00.000Z',
  athlete: { id: 'a' + id, name: 'Fulano', shortName: 'Fulano', position: 'ATA', jerseyNumber: 9, teamId: 't1' },
})

describe('MatchEventsTimeline', () => {
  it('mostra estado vazio sem eventos', () => {
    render(<MatchEventsTimeline events={[]} />)
    expect(screen.getByText(/sem eventos/i)).toBeInTheDocument()
  })
  it('lista eventos com minuto, nome e rótulo', () => {
    render(<MatchEventsTimeline events={[ev('1', 'GOAL', 10)]} />)
    expect(screen.getByText("10'")).toBeInTheDocument()
    expect(screen.getByText('Fulano')).toBeInTheDocument()
    expect(screen.getByText('Gol')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --pool=threads src/components/MatchEventsTimeline.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar o componente**

`src/components/MatchEventsTimeline.tsx`:

```tsx
import type { MatchEventEntryDto } from '@/lib/contracts/matchEvents'
import { ACTION_ICONS } from '@/lib/actionIcons'
import { ACTION_LABELS } from '@/types/domain'

interface Props {
  events: MatchEventEntryDto[]
}

export function MatchEventsTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground bg-surface rounded-lg">
        Ainda sem eventos nesta partida.
      </div>
    )
  }
  return (
    <div className="bg-surface rounded-lg overflow-hidden">
      {events.map((evt) => (
        <div key={evt.id} className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border/50 last:border-b-0">
          <span aria-hidden className="text-base leading-none">{ACTION_ICONS[evt.action]}</span>
          <span className="text-xs text-muted-foreground tabular-nums w-8">{evt.minute}&apos;</span>
          <span className="font-medium truncate">{evt.athlete.shortName}</span>
          <span className="ml-auto text-muted-foreground text-xs">{ACTION_LABELS[evt.action]}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run --pool=threads src/components/MatchEventsTimeline.test.tsx`
Expected: PASS.

- [ ] **Step 5: Integrar na página `/matches/[id]`**

Em `src/app/matches/[id]/page.tsx`:

Adicionar imports:

```ts
import { MatchEventsTimeline } from '@/components/MatchEventsTimeline'
import { useMatchEvents } from '@/hooks/useMatchEvents'
import { useMyRooms } from '@/hooks/useMyRooms'
import { findActiveRoomForMatch } from '@/lib/activeRoom'
```

Dentro do componente, após `const createRoom = useCreateRoom()`:

```ts
const isPlayedOrLive =
  match.data?.status === 'live' ||
  match.data?.status === 'finished' ||
  (match.data?.status === 'scheduled' && match.data?.homeScore !== null && match.data?.awayScore !== null)

const events = useMatchEvents(id, Boolean(match.data) && Boolean(isPlayedOrLive))

const myRooms = useMyRooms('active', { enabled: Boolean(user) })
const activeRoom = match.data ? findActiveRoomForMatch(myRooms.data?.active, match.data.id) : null
```

Trocar o botão de criar sala: dentro do bloco `{match.data.status !== MatchStatus.FINISHED && (…)}`, se `activeRoom` existir, renderizar um link "Voltar para a sala" em vez do botão "Criar sala":

```tsx
{match.data.status !== MatchStatus.FINISHED && (
  activeRoom ? (
    <Button asChild className="mt-4 w-full">
      <Link href={`/rooms/${activeRoom.id}`}>Voltar para a sala</Link>
    </Button>
  ) : (
    <Button
      type="button"
      className="mt-4 w-full"
      onClick={handleCreateRoom}
      disabled={createRoom.isPending}
    >
      {createRoom.isPending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {getCreateRoomButtonLabel({ isPending: createRoom.isPending, isAuthed: Boolean(user) })}
    </Button>
  )
)}
```

(Verificar se o `Button` do projeto suporta `asChild`; se não, usar `onClick={() => router.push(...)}` num `Button` normal.)

Substituir a `<section>` de "Jogadores Disponíveis" por um condicional: quando `isPlayedOrLive`, mostrar eventos; senão, a `LineupGrid` atual:

```tsx
<section>
  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
    {isPlayedOrLive ? 'Eventos da Partida' : 'Jogadores Disponíveis'}
  </h2>
  {isPlayedOrLive ? (
    events.isLoading ? (
      <p className="text-sm text-muted-foreground">Carregando…</p>
    ) : events.isError ? (
      <p className="text-sm text-event-negative">Não foi possível carregar os eventos.</p>
    ) : (
      <MatchEventsTimeline events={events.data ?? []} />
    )
  ) : (
    <>
      {lineups.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {lineups.isError && (
        <p className="text-sm text-event-negative">Não foi possível carregar as escalações.</p>
      )}
      {lineups.data && (
        <LineupGrid lineups={lineups.data} homeTeam={match.data.homeTeam} awayTeam={match.data.awayTeam} />
      )}
    </>
  )}
</section>
```

- [ ] **Step 6: Typecheck + lint + testes da página**

Run: `npx tsc --noEmit && npm run lint && npx vitest run --pool=threads src/app`
Expected: ok/PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/MatchEventsTimeline.tsx src/components/MatchEventsTimeline.test.tsx src/app/matches/\[id\]/page.tsx
git commit -m "feat(matches): eventos quando ao vivo/encerrada + voltar para a sala"
```

---

### Task 3.10: Verificação final do frontend

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run --pool=threads`
Expected: PASS.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificação visual (manual, com o usuário)**

Rodar `npm run start:dev` e conferir as 4 telas: lista de campeonatos (jogo ao vivo destacado + minuto), `/matches/[id]` (cor do visitante invertida quando colide, eventos quando ao vivo/encerrada, botão "Voltar para a sala"), draft (atletas coloridos), ao vivo (escudos no placar, layout A, header mobile sem texto "AO VIVO", modal de substituição em 3 passos, ícones nos eventos).

---

## Self-review (cobertura da spec)

| Item da spec | Task(s) |
|---|---|
| B1 endpoint de eventos | 0.3 |
| B2 imageUrl no snapshot | 0.1, 1.1 |
| B3 match.id no resumo | 0.2, 1.1 |
| P1 teamColors | 1.2 |
| P2 actionIcons | 1.3 |
| Item 1 destaque ao vivo | 3.1 |
| Item 2 inversão de cor | 3.1, 3.2 |
| Item 3 eventos em /matches | 2.1, 3.9 |
| Item 4 voltar pra sala | 2.2, 3.9 |
| Item 5 cores no draft+ao vivo | 3.2, 3.3, 3.5 |
| Item 6 escudos no placar | 3.4 |
| Item 7 layout ao vivo | 3.6 |
| Item 8 mobile header | 3.4 |
| Item 9 modal de substituição | 3.7 |
| Item 10 ícones nos eventos | 3.8 (ao vivo), 3.9 (matches) |

Todos os itens da spec têm tarefa correspondente.
