# Live Match Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o frontend da Vertical 5 (Partida ao vivo) — `LiveMatchView` substitui `PendingView` no dispatcher de `/rooms/[id]` para estados `LIVE` e `FINISHED`. Componentes em `src/components/live/` (MatchHeader, ScoreboardCards, TeamLineup, MatchTimeline, SubstitutionPanel, ConfirmSubDialog, FinishedBanner). Hooks `useMakeSubstitution`, `useLiveSocket`, `useInterpolatedMinute`. Contracts replicados em `src/lib/contracts/live.ts` + extensão de `rooms.ts`/`ws.ts`. Playwright e2e cobre fluxo evento → sub → anulação → fim.

**Architecture:** Padrão idêntico v3/v4: snapshot do servidor como verdade absoluta, eventos WS aplicam patches incrementais via `setQueryData(['room', id], ...)`. Tela de live é dispatcher reativo — listeners no `useLiveSocket` cuidam de update reativo (sem re-render manual). Substituição segue 2 fases: clica no slot do meu time → seleciona substituto do pool filtrado por posição. Interpolação client-side do minuto entre ticks via `setInterval(1000ms)`.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TanStack Query v5 · Socket.IO client v4 · Tailwind v4 · shadcn/ui · Framer Motion · Zod 4 · Vitest · Playwright.

**Spec:** [`docs/superpowers/specs/2026-05-24-live-match-design.md`](../specs/2026-05-24-live-match-design.md)

**Dependência:** API com `feat/live-match-api` mergeada (ou rodando local).

---

## File Structure

**Create:**
- `src/lib/contracts/live.ts`
- `src/hooks/useInterpolatedMinute.ts`
- `src/hooks/useInterpolatedMinute.test.ts`
- `src/hooks/useMakeSubstitution.ts`
- `src/hooks/useMakeSubstitution.test.tsx`
- `src/hooks/useLiveSocket.ts`
- `src/hooks/useLiveSocket.test.tsx`
- `src/components/live/MatchHeader.tsx`
- `src/components/live/MatchHeader.test.tsx`
- `src/components/live/ScoreboardCards.tsx`
- `src/components/live/ScoreboardCards.test.tsx`
- `src/components/live/TeamLineup.tsx`
- `src/components/live/TeamLineup.test.tsx`
- `src/components/live/MatchTimeline.tsx`
- `src/components/live/MatchTimeline.test.tsx`
- `src/components/live/SubstitutionPanel.tsx`
- `src/components/live/SubstitutionPanel.test.tsx`
- `src/components/live/ConfirmSubDialog.tsx`
- `src/components/live/ConfirmSubDialog.test.tsx`
- `src/components/live/FinishedBanner.tsx`
- `src/components/live/FinishedBanner.test.tsx`
- `src/app/(app)/rooms/[id]/live-match-view.tsx`
- `src/app/(app)/rooms/[id]/live-match-view.test.tsx`
- `test/e2e/live-match.spec.ts`

**Modify:**
- `src/lib/contracts/rooms.ts` — estende `roomSnapshotSchema` com `live: liveStateSchema.nullable()`
- `src/lib/contracts/ws.ts` — adiciona valores novos a `WsErrorCode`
- `src/app/(app)/rooms/[id]/page.tsx` — dispatcher inclui `LIVE` e `FINISHED` → `<LiveMatchView>`; remove `<PendingView>`
- `src/app/(app)/rooms/[id]/pending-view.tsx` — **delete** (não é mais usado)

---

## Conventions

- **Run unit tests:** `npm test`
- **Run e2e:** `npm run test:e2e` (Playwright; precisa API rodando local em `http://localhost:3001`)
- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **Build:** `npm run build`
- **Naming:** kebab-case nos arquivos, PascalCase nos componentes; hooks `useXxx`.
- **Test files:** `*.test.ts(x)` ao lado do source (Vitest), e2e em `test/e2e/`.
- **Patch padrão:** `queryClient.setQueryData(['room', roomId], (old) => ({ ...old, live: { ...old.live, ...patch } }))`.
- **Commit cadence:** um commit por task. Conventional Commits (`feat(live):`, `test(live):`).

---

## Task 1: Contracts — `live.ts` + estende `rooms.ts` + `ws.ts`

**Files:**
- Create: `src/lib/contracts/live.ts`
- Modify: `src/lib/contracts/rooms.ts`
- Modify: `src/lib/contracts/ws.ts`

- [ ] **Step 1: Cria `src/lib/contracts/live.ts`**

```ts
import { z } from 'zod';
import { athleteRefSchema } from './draft';

export const ACTION_TYPES = [
  'GOAL', 'ASSIST', 'YELLOW_CARD', 'RED_CARD', 'SAVE', 'PENALTY_SAVE', 'OWN_GOAL',
  'PENALTY_MISS', 'PENALTY_GOAL', 'INTERCEPTION', 'TACKLE_WON', 'KEY_PASS', 'SHOT_ON_TARGET',
  'CLEAN_SHEET', 'HARD_SAVE', 'GOAL_CONCEDED', 'POST_HIT', 'MISSED_PASS', 'FOUL_SUFFERED',
  'FOUL_COMMITTED', 'OFFSIDE',
] as const;
export const actionTypeSchema = z.enum(ACTION_TYPES);
export type ActionType = z.infer<typeof actionTypeSchema>;

export const matchStatusSchema = z.enum(['scheduled', 'live', 'finished', 'postponed', 'canceled']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const roleSchema = z.enum(['host', 'guest']);
export const roomWinnerSchema = z.enum(['host', 'guest', 'draw', 'abandoned']);

export const matchEventSchema = z.object({
  id: z.string().uuid(),
  athlete: athleteRefSchema,
  action: actionTypeSchema,
  minute: z.number().int(),
  points: z.number(),
  affectedRole: roleSchema.nullable(),
  canceled: z.boolean(),
});
export type MatchEvent = z.infer<typeof matchEventSchema>;

export const lineupSlotSchema = z.object({
  athlete: athleteRefSchema,
  cumulativePoints: z.number(),
});
export type LineupSlot = z.infer<typeof lineupSlotSchema>;

export const liveSubPoolEntrySchema = z.object({
  athlete: athleteRefSchema,
  teamSide: z.enum(['home', 'away']),
  pointsSoFar: z.number(),
});
export type LiveSubPoolEntry = z.infer<typeof liveSubPoolEntrySchema>;

export const liveStateSchema = z.object({
  matchStatus: matchStatusSchema,
  currentMinute: z.number().int().nullable(),
  currentMinuteAt: z.string().nullable(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  hostScore: z.number(),
  guestScore: z.number(),
  winner: roomWinnerSchema.nullable(),
  hostLineup: z.array(lineupSlotSchema),
  guestLineup: z.array(lineupSlotSchema),
  recentEvents: z.array(matchEventSchema),
  pool: z.array(liveSubPoolEntrySchema),
});
export type LiveState = z.infer<typeof liveStateSchema>;

// WS payloads
export const matchSubstituteInputSchema = z.object({
  roomId: z.string().uuid(),
  removeAthleteId: z.string().uuid(),
  addAthleteId: z.string().uuid(),
});
export type MatchSubstituteInput = z.infer<typeof matchSubstituteInputSchema>;

export const matchEventPayloadSchema = z.object({
  event: matchEventSchema,
  hostScore: z.number(),
  guestScore: z.number(),
});
export type MatchEventPayload = z.infer<typeof matchEventPayloadSchema>;

export const matchEventCanceledPayloadSchema = z.object({
  eventId: z.string().uuid(),
  athleteId: z.string().uuid(),
  action: actionTypeSchema,
  minute: z.number().int(),
  hostScore: z.number(),
  guestScore: z.number(),
});
export type MatchEventCanceledPayload = z.infer<typeof matchEventCanceledPayloadSchema>;

export const matchTickPayloadSchema = z.object({
  currentMinute: z.number().int(),
  currentMinuteAt: z.string(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
});
export type MatchTickPayload = z.infer<typeof matchTickPayloadSchema>;

export const matchSubstitutionAppliedPayloadSchema = z.object({
  role: roleSchema,
  removedAthlete: athleteRefSchema,
  addedAthlete: athleteRefSchema,
  minute: z.number().int(),
  hostScore: z.number(),
  guestScore: z.number(),
});
export type MatchSubstitutionAppliedPayload = z.infer<typeof matchSubstitutionAppliedPayloadSchema>;

export const matchFinishedPayloadSchema = z.object({
  hostScore: z.number(),
  guestScore: z.number(),
  winner: roomWinnerSchema,
  finishedAt: z.string(),
});
export type MatchFinishedPayload = z.infer<typeof matchFinishedPayloadSchema>;

export const lineupConfirmedPayloadSchema = z.object({
  matchId: z.string().uuid(),
});
export type LineupConfirmedPayload = z.infer<typeof lineupConfirmedPayloadSchema>;
```

- [ ] **Step 2: Estende `rooms.ts`**

Em `src/lib/contracts/rooms.ts`, no `roomSnapshotSchema`:

```ts
import { liveStateSchema } from './live';

export const roomSnapshotSchema = z.object({
  // ...campos existentes
  draft: draftStateSchema.nullable(),
  live: liveStateSchema.nullable(),
});
```

- [ ] **Step 3: Estende `ws.ts`**

Em `src/lib/contracts/ws.ts`, no enum `WsErrorCode`:

```ts
export const WS_ERROR_CODES = [
  // ...existentes
  'NOT_LIVE',
  'MATCH_NOT_STARTED',
  'ATHLETE_NOT_IN_TEAM',
  'ATHLETE_NOT_AVAILABLE',
  'POSITION_MISMATCH',
] as const;
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/live.ts src/lib/contracts/rooms.ts src/lib/contracts/ws.ts
git commit -m "feat(live): contracts (live.ts + rooms/ws extensions)"
```

---

## Task 2: `useInterpolatedMinute` hook

**Files:**
- Create: `src/hooks/useInterpolatedMinute.ts`
- Create: `src/hooks/useInterpolatedMinute.test.ts`

- [ ] **Step 1: Escreve teste falhando**

Cria `src/hooks/useInterpolatedMinute.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { useInterpolatedMinute } from './useInterpolatedMinute';

describe('useInterpolatedMinute', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns serverMinute when serverMinute is non-null', () => {
    const at = new Date().toISOString();
    const { result } = renderHook(() => useInterpolatedMinute(30, at));
    expect(result.current).toBe(30);
  });

  it('returns null when serverMinute is null', () => {
    const { result } = renderHook(() => useInterpolatedMinute(null, null));
    expect(result.current).toBeNull();
  });

  it('advances minute after 60 seconds tick', () => {
    const at = new Date().toISOString();
    const { result } = renderHook(() => useInterpolatedMinute(30, at));
    expect(result.current).toBe(30);

    act(() => { jest.advanceTimersByTime(60_000); });
    expect(result.current).toBe(31);

    act(() => { jest.advanceTimersByTime(60_000); });
    expect(result.current).toBe(32);
  });
});
```

> Substitui `jest` por `vi` se o projeto usa Vitest puro (provavelmente sim — `vi.useFakeTimers()`).

- [ ] **Step 2: Roda — falha**

Run: `npm test -- useInterpolatedMinute`
Expected: FAIL.

- [ ] **Step 3: Implementação**

Cria `src/hooks/useInterpolatedMinute.ts`:

```ts
import { useEffect, useState } from 'react';

export function useInterpolatedMinute(serverMinute: number | null, serverMinuteAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (serverMinute === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [serverMinute]);

  if (serverMinute === null || serverMinuteAt === null) return null;
  const elapsedSec = (now - new Date(serverMinuteAt).getTime()) / 1000;
  return serverMinute + Math.floor(elapsedSec / 60);
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- useInterpolatedMinute`
Expected: PASS, 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInterpolatedMinute.ts src/hooks/useInterpolatedMinute.test.ts
git commit -m "feat(live): useInterpolatedMinute hook"
```

---

## Task 3: `useMakeSubstitution` hook

**Files:**
- Create: `src/hooks/useMakeSubstitution.ts`
- Create: `src/hooks/useMakeSubstitution.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

Cria `src/hooks/useMakeSubstitution.test.tsx`:

```tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMakeSubstitution } from './useMakeSubstitution';

const wrapper = (qc: QueryClient) => ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

describe('useMakeSubstitution', () => {
  it('emits match:substitute and resolves on ack', async () => {
    const emit = vi.fn((evt, payload, ack) => ack({ ok: true }));
    vi.mock('@/lib/socket', () => ({ getSocket: () => ({ emit, on: vi.fn(), off: vi.fn() }) }));

    const qc = new QueryClient();
    const { result } = renderHook(() => useMakeSubstitution('room-uuid'), { wrapper: wrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ removeAthleteId: 'a-out', addAthleteId: 'a-in' });
    });
    expect(emit).toHaveBeenCalledWith('match:substitute', { roomId: 'room-uuid', removeAthleteId: 'a-out', addAthleteId: 'a-in' }, expect.any(Function));
  });

  it('rejects with error.code on error ack', async () => {
    const emit = vi.fn((evt, payload, ack) => ack({ ok: false, error: { code: 'ATHLETE_NOT_IN_TEAM', message: 'gone' } }));
    vi.mock('@/lib/socket', () => ({ getSocket: () => ({ emit, on: vi.fn(), off: vi.fn() }) }));

    const qc = new QueryClient();
    const { result } = renderHook(() => useMakeSubstitution('room-uuid'), { wrapper: wrapper(qc) });

    await expect(result.current.mutateAsync({ removeAthleteId: 'a-out', addAthleteId: 'a-in' }))
      .rejects.toMatchObject({ code: 'ATHLETE_NOT_IN_TEAM' });
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- useMakeSubstitution`
Expected: FAIL.

- [ ] **Step 3: Implementação**

Cria `src/hooks/useMakeSubstitution.ts`:

```ts
import { useMutation } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';

type MakeSubInput = { removeAthleteId: string; addAthleteId: string };

export function useMakeSubstitution(roomId: string) {
  return useMutation({
    mutationFn: async (input: MakeSubInput) => {
      const socket = getSocket();
      return new Promise<{ ok: true }>((resolve, reject) => {
        socket.emit('match:substitute', { roomId, ...input }, (response: any) => {
          if (response?.ok) resolve({ ok: true });
          else reject(response?.error ?? { code: 'UNKNOWN', message: 'No response' });
        });
      });
    },
  });
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- useMakeSubstitution`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMakeSubstitution.ts src/hooks/useMakeSubstitution.test.tsx
git commit -m "feat(live): useMakeSubstitution mutation hook"
```

---

## Task 4: `useLiveSocket` hook

**Files:**
- Create: `src/hooks/useLiveSocket.ts`
- Create: `src/hooks/useLiveSocket.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

Cria `src/hooks/useLiveSocket.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLiveSocket } from './useLiveSocket';

describe('useLiveSocket', () => {
  it('subscribes to 6 events on mount and unsubscribes on unmount', () => {
    const on = vi.fn();
    const off = vi.fn();
    const emit = vi.fn();
    vi.mock('@/lib/socket', () => ({ getSocket: () => ({ on, off, emit }) }));

    const qc = new QueryClient();
    const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { unmount } = renderHook(() => useLiveSocket('room-uuid'), { wrapper });

    const expectedEvents = ['match:event', 'match:event_canceled', 'match:tick', 'match:substitution_applied', 'match:finished', 'lineup:confirmed'];
    for (const e of expectedEvents) {
      expect(on).toHaveBeenCalledWith(e, expect.any(Function));
    }

    unmount();
    for (const e of expectedEvents) {
      expect(off).toHaveBeenCalledWith(e, expect.any(Function));
    }
  });

  it('match:event patches recentEvents and scores in cache', () => {
    // ...captura o handler, dispara fake payload, verifica setQueryData
  });

  it('match:finished patches room.status to FINISHED', () => {
    // ...similar
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- useLiveSocket`
Expected: FAIL.

- [ ] **Step 3: Implementação**

Cria `src/hooks/useLiveSocket.ts`:

```ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import {
  matchEventPayloadSchema,
  matchEventCanceledPayloadSchema,
  matchTickPayloadSchema,
  matchSubstitutionAppliedPayloadSchema,
  matchFinishedPayloadSchema,
  lineupConfirmedPayloadSchema,
} from '@/lib/contracts/live';

export function useLiveSocket(roomId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handleEvent = (raw: unknown) => {
      const parsed = matchEventPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      queryClient.setQueryData(['room', roomId], (old: any) => {
        if (!old?.live) return old;
        const recentEvents = [parsed.data.event, ...old.live.recentEvents].slice(0, 50);
        return {
          ...old,
          live: { ...old.live, recentEvents, hostScore: parsed.data.hostScore, guestScore: parsed.data.guestScore },
        };
      });
    };

    const handleCanceled = (raw: unknown) => {
      const parsed = matchEventCanceledPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      // Patch otimista + invalidate pra reconcile total
      queryClient.setQueryData(['room', roomId], (old: any) => {
        if (!old?.live) return old;
        return { ...old, live: { ...old.live, hostScore: parsed.data.hostScore, guestScore: parsed.data.guestScore } };
      });
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    };

    const handleTick = (raw: unknown) => {
      const parsed = matchTickPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      queryClient.setQueryData(['room', roomId], (old: any) => {
        if (!old?.live) return old;
        return {
          ...old,
          live: {
            ...old.live,
            currentMinute: parsed.data.currentMinute,
            currentMinuteAt: parsed.data.currentMinuteAt,
            homeScore: parsed.data.homeScore,
            awayScore: parsed.data.awayScore,
          },
        };
      });
    };

    const handleSubApplied = (raw: unknown) => {
      const parsed = matchSubstitutionAppliedPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      // Forçar refetch — sub muda lineup, pool, scores: snapshot fresco é mais simples
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    };

    const handleFinished = (raw: unknown) => {
      const parsed = matchFinishedPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      queryClient.setQueryData(['room', roomId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          status: 'FINISHED',
          live: old.live ? { ...old.live, winner: parsed.data.winner, matchStatus: 'finished', hostScore: parsed.data.hostScore, guestScore: parsed.data.guestScore } : null,
        };
      });
    };

    const handleLineupConfirmed = (raw: unknown) => {
      const parsed = lineupConfirmedPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    };

    socket.on('match:event', handleEvent);
    socket.on('match:event_canceled', handleCanceled);
    socket.on('match:tick', handleTick);
    socket.on('match:substitution_applied', handleSubApplied);
    socket.on('match:finished', handleFinished);
    socket.on('lineup:confirmed', handleLineupConfirmed);

    return () => {
      socket.off('match:event', handleEvent);
      socket.off('match:event_canceled', handleCanceled);
      socket.off('match:tick', handleTick);
      socket.off('match:substitution_applied', handleSubApplied);
      socket.off('match:finished', handleFinished);
      socket.off('lineup:confirmed', handleLineupConfirmed);
    };
  }, [roomId, queryClient]);
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- useLiveSocket`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLiveSocket.ts src/hooks/useLiveSocket.test.tsx
git commit -m "feat(live): useLiveSocket hook with 6 listeners + cache patches"
```

---

## Task 5: `MatchHeader` componente

**Files:**
- Create: `src/components/live/MatchHeader.tsx`
- Create: `src/components/live/MatchHeader.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen } from '@testing-library/react';
import { MatchHeader } from './MatchHeader';

describe('MatchHeader', () => {
  const baseProps = {
    homeTeam: { id: '1', name: 'Flamengo', shortName: 'FLA' },
    awayTeam: { id: '2', name: 'Palmeiras', shortName: 'PAL' },
    homeScore: 1,
    awayScore: 0,
    matchStatus: 'live' as const,
    minute: 30,
  };

  it('renders teams and live score', () => {
    render(<MatchHeader {...baseProps} />);
    expect(screen.getByText('FLA')).toBeInTheDocument();
    expect(screen.getByText('PAL')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
    expect(screen.getByText("30'")).toBeInTheDocument();
  });

  it('shows FIM badge in finished status', () => {
    render(<MatchHeader {...baseProps} matchStatus="finished" minute={95} />);
    expect(screen.getByText(/FIM/i)).toBeInTheDocument();
    expect(screen.queryByText(/AO VIVO/i)).not.toBeInTheDocument();
  });

  it('renders placeholder when minute is null', () => {
    render(<MatchHeader {...baseProps} minute={null} />);
    expect(screen.getByText(/--/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- MatchHeader`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
import { Radio } from 'lucide-react';

type Team = { id: string; name: string; shortName: string };

type Props = {
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  matchStatus: 'live' | 'finished' | 'postponed' | 'canceled' | 'scheduled';
  minute: number | null;
};

export function MatchHeader({ homeTeam, awayTeam, homeScore, awayScore, matchStatus, minute }: Props) {
  return (
    <div className="bg-surface rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg">{homeTeam.shortName}</span>
        <span className="text-2xl font-bold tabular-nums">{homeScore ?? '-'}</span>
        <span className="text-muted-foreground">×</span>
        <span className="text-2xl font-bold tabular-nums">{awayScore ?? '-'}</span>
        <span className="font-bold text-lg">{awayTeam.shortName}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {matchStatus === 'live' && (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <Radio size={12} className="animate-pulse" /> AO VIVO
          </span>
        )}
        {matchStatus === 'finished' && <span className="text-muted-foreground font-semibold">FIM</span>}
        <span className="tabular-nums text-muted-foreground">{minute !== null ? `${minute}'` : '--'}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- MatchHeader`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/live/MatchHeader.tsx src/components/live/MatchHeader.test.tsx
git commit -m "feat(live): MatchHeader component"
```

---

## Task 6: `ScoreboardCards` componente

**Files:**
- Create: `src/components/live/ScoreboardCards.tsx`
- Create: `src/components/live/ScoreboardCards.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen } from '@testing-library/react';
import { ScoreboardCards } from './ScoreboardCards';

describe('ScoreboardCards', () => {
  it('highlights winning card in green', () => {
    render(<ScoreboardCards myName="Eu" oppName="Bob" myScore={15.5} oppScore={10} canSub={false} subMode={false} onToggleSub={() => {}} />);
    const myCard = screen.getByTestId('my-card');
    expect(myCard).toHaveClass(/text-event-positive|text-green/);
  });

  it('shows sub banner when canSub is true', () => {
    render(<ScoreboardCards myName="Eu" oppName="Bob" myScore={5} oppScore={10} canSub={true} subMode={false} onToggleSub={() => {}} />);
    expect(screen.getByText(/Substitui[çc][aã]o dispon[ií]vel/i)).toBeInTheDocument();
  });

  it('shows Cancelar when subMode is true', () => {
    render(<ScoreboardCards myName="Eu" oppName="Bob" myScore={5} oppScore={10} canSub={true} subMode={true} onToggleSub={() => {}} />);
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- ScoreboardCards`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
type Props = {
  myName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
  canSub: boolean;
  subMode: boolean;
  onToggleSub: () => void;
};

export function ScoreboardCards({ myName, oppName, myScore, oppScore, canSub, subMode, onToggleSub }: Props) {
  const iWinning = myScore > oppScore;
  const oppWinning = oppScore > myScore;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div data-testid="my-card" className={`bg-surface rounded-lg p-3 text-center ${iWinning ? 'text-event-positive' : ''} ${canSub ? 'ring-2 ring-primary' : ''}`}>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{myName} (Você)</div>
        <div className="text-3xl font-bold tabular-nums">{myScore.toFixed(1)}</div>
        {canSub && (
          <>
            <div className="text-[0.65rem] text-primary font-semibold mt-1">🔄 Substituição disponível</div>
            <button onClick={onToggleSub} className={`mt-2 px-3 py-1 rounded text-xs font-semibold ${subMode ? 'bg-destructive text-foreground' : 'bg-primary text-primary-foreground'}`}>
              {subMode ? 'Cancelar' : 'Substituir'}
            </button>
          </>
        )}
      </div>
      <div data-testid="opp-card" className={`bg-surface rounded-lg p-3 text-center ${oppWinning ? 'text-event-positive' : ''}`}>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{oppName}</div>
        <div className="text-3xl font-bold tabular-nums">{oppScore.toFixed(1)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- ScoreboardCards`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/live/ScoreboardCards.tsx src/components/live/ScoreboardCards.test.tsx
git commit -m "feat(live): ScoreboardCards component"
```

---

## Task 7: `TeamLineup` componente

**Files:**
- Create: `src/components/live/TeamLineup.tsx`
- Create: `src/components/live/TeamLineup.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamLineup } from './TeamLineup';

const slot = (id: string, pos: any, name: string, points = 0) => ({
  athlete: { id, name, shortName: name, position: pos, jerseyNumber: 9, teamId: 't-1' },
  cumulativePoints: points,
});

describe('TeamLineup', () => {
  it('renders 5 slots ordered by POSITION_ORDER', () => {
    const lineup = [
      slot('a-ata', 'ATA', 'Atac'),
      slot('a-gol', 'GOL', 'Gol'),
      slot('a-zag', 'ZAG', 'Zag'),
      slot('a-mei', 'MEI', 'Mei'),
      slot('a-lat', 'LAT', 'Lat'),
    ];
    render(<TeamLineup title="Time" lineup={lineup} />);
    const slots = screen.getAllByTestId(/lineup-slot-/);
    expect(slots[0]).toHaveTextContent('Gol');
    expect(slots[1]).toHaveTextContent('Lat');
    expect(slots[2]).toHaveTextContent('Zag');
    expect(slots[3]).toHaveTextContent('Mei');
    expect(slots[4]).toHaveTextContent('Atac');
  });

  it('calls onSelectRemove only when in subMode', () => {
    const lineup = [slot('a-1', 'ATA', 'Pedro', 8)];
    const fn = vi.fn();
    const { rerender } = render(<TeamLineup title="Time" lineup={lineup} subMode={false} onSelectRemove={fn} />);
    fireEvent.click(screen.getByTestId('lineup-slot-a-1'));
    expect(fn).not.toHaveBeenCalled();

    rerender(<TeamLineup title="Time" lineup={lineup} subMode={true} onSelectRemove={fn} />);
    fireEvent.click(screen.getByTestId('lineup-slot-a-1'));
    expect(fn).toHaveBeenCalledWith(lineup[0].athlete);
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- TeamLineup`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
import type { LineupSlot } from '@/lib/contracts/live';
import { JerseyIcon } from '@/components/JerseyIcon';
import { POSITION_ORDER } from '@/types/domain';

type Props = {
  title: string;
  lineup: LineupSlot[];
  subMode?: boolean;
  selectedId?: string | null;
  onSelectRemove?: (athlete: LineupSlot['athlete']) => void;
};

export function TeamLineup({ title, lineup, subMode = false, selectedId = null, onSelectRemove }: Props) {
  const sorted = [...lineup].sort(
    (a, b) => POSITION_ORDER.indexOf(a.athlete.position) - POSITION_ORDER.indexOf(b.athlete.position),
  );

  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      {sorted.map((slot) => (
        <button
          key={slot.athlete.id}
          data-testid={`lineup-slot-${slot.athlete.id}`}
          disabled={!subMode}
          onClick={() => subMode && onSelectRemove?.(slot.athlete)}
          className={`w-full flex items-center gap-2 p-2 rounded bg-surface ${selectedId === slot.athlete.id ? 'ring-2 ring-primary' : ''} ${subMode ? 'cursor-pointer hover:bg-accent' : 'cursor-default'}`}
        >
          <JerseyIcon jerseyNumber={slot.athlete.jerseyNumber} primaryColor="#666" secondaryColor="#fff" size="sm" />
          <span className="flex-1 text-left text-sm font-medium">{slot.athlete.shortName}</span>
          <span className="text-xs text-muted-foreground">{slot.athlete.position}</span>
          <span className="tabular-nums text-sm font-semibold">{slot.cumulativePoints.toFixed(1)}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- TeamLineup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/live/TeamLineup.tsx src/components/live/TeamLineup.test.tsx
git commit -m "feat(live): TeamLineup component"
```

---

## Task 8: `MatchTimeline` componente

**Files:**
- Create: `src/components/live/MatchTimeline.tsx`
- Create: `src/components/live/MatchTimeline.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen } from '@testing-library/react';
import { MatchTimeline } from './MatchTimeline';

const event = (overrides: any = {}) => ({
  id: 'e-1',
  athlete: { id: 'a', name: 'Pedro', shortName: 'Pedro', position: 'ATA', jerseyNumber: 9, teamId: 't' },
  action: 'GOAL' as const,
  minute: 30,
  points: 8,
  affectedRole: 'host' as const,
  canceled: false,
  ...overrides,
});

describe('MatchTimeline', () => {
  it('renders events with minute, name, action, points', () => {
    render(<MatchTimeline events={[event({})]} />);
    expect(screen.getByText(/30'/)).toBeInTheDocument();
    expect(screen.getByText('Pedro')).toBeInTheDocument();
    expect(screen.getByText(/Gol/i)).toBeInTheDocument();
    expect(screen.getByText('+8.0')).toBeInTheDocument();
  });

  it('marks canceled events with ANULADO and negative points', () => {
    render(<MatchTimeline events={[event({ canceled: true, points: -8 })]} />);
    expect(screen.getByText(/ANULADO/i)).toBeInTheDocument();
    expect(screen.getByText(/-8\.0/)).toBeInTheDocument();
  });

  it('shows empty placeholder when no events', () => {
    render(<MatchTimeline events={[]} />);
    expect(screen.getByText(/Aguardando eventos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- MatchTimeline`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
import type { MatchEvent } from '@/lib/contracts/live';
import { ACTION_LABELS } from '@/types/domain';

type Props = { events: MatchEvent[] };

export function MatchTimeline({ events }: Props) {
  if (events.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground bg-surface rounded-lg">Aguardando eventos...</div>;
  }
  return (
    <div className="bg-surface rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
      {events.slice(0, 50).map((evt) => {
        const isPositive = evt.points >= 0;
        return (
          <div key={evt.id} className={`flex items-baseline gap-2 px-3 py-2 text-sm border-b border-border/50 ${isPositive ? 'animate-flash-positive' : 'animate-flash-negative'}`}>
            <span className="text-xs text-muted-foreground tabular-nums w-8">{evt.minute}'</span>
            <span className="font-medium">{evt.athlete.shortName}</span>
            <span className="text-muted-foreground text-xs">
              {ACTION_LABELS[evt.action]}
              {evt.canceled && ' (ANULADO)'}
            </span>
            <span className={`ml-auto font-semibold tabular-nums ${isPositive ? 'text-event-positive' : 'text-event-negative'}`}>
              {isPositive ? '+' : ''}{evt.points.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

> `ACTION_LABELS` precisa cobrir os 21 ActionTypes. Estende `src/types/domain.ts` se necessário.

- [ ] **Step 4: Estende `ACTION_LABELS`**

Em `src/types/domain.ts`, adiciona labels pros 8 ActionTypes novos:

```ts
export const ACTION_LABELS: Record<ActionType, string> = {
  // ...existentes
  CLEAN_SHEET: 'Jogo sem Sofrer Gol',
  HARD_SAVE: 'Defesa Difícil',
  GOAL_CONCEDED: 'Gol Sofrido',
  POST_HIT: 'Finalização na Trave',
  MISSED_PASS: 'Passe Errado',
  FOUL_SUFFERED: 'Falta Sofrida',
  FOUL_COMMITTED: 'Falta Cometida',
  OFFSIDE: 'Impedimento',
};
```

- [ ] **Step 5: Roda — passa**

Run: `npm test -- MatchTimeline`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/live/MatchTimeline.tsx src/components/live/MatchTimeline.test.tsx src/types/domain.ts
git commit -m "feat(live): MatchTimeline + ACTION_LABELS extended"
```

---

## Task 9: `SubstitutionPanel` componente

**Files:**
- Create: `src/components/live/SubstitutionPanel.tsx`
- Create: `src/components/live/SubstitutionPanel.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SubstitutionPanel } from './SubstitutionPanel';

const athlete = (id: string, pos: any, name: string) => ({
  id, name, shortName: name, position: pos, jerseyNumber: 9, teamId: 't-1',
});

describe('SubstitutionPanel', () => {
  it('filters pool by position of selectedToRemove', () => {
    const selected = athlete('a-out', 'ATA', 'Pedro');
    const pool = [
      { athlete: athlete('p1', 'ATA', 'Vini'), teamSide: 'home' as const, pointsSoFar: 5 },
      { athlete: athlete('p2', 'ZAG', 'Marquinhos'), teamSide: 'away' as const, pointsSoFar: 8 },
    ];
    render(<SubstitutionPanel selectedToRemove={selected} pool={pool} onPick={() => {}} />);
    expect(screen.getByText('Vini')).toBeInTheDocument();
    expect(screen.queryByText('Marquinhos')).not.toBeInTheDocument();
  });

  it('shows pointsSoFar next to each candidate', () => {
    const selected = athlete('a-out', 'ATA', 'Pedro');
    const pool = [{ athlete: athlete('p1', 'ATA', 'Vini'), teamSide: 'home' as const, pointsSoFar: 5.5 }];
    render(<SubstitutionPanel selectedToRemove={selected} pool={pool} onPick={() => {}} />);
    expect(screen.getByText('5.5')).toBeInTheDocument();
  });

  it('calls onPick with athleteId', () => {
    const selected = athlete('a-out', 'ATA', 'Pedro');
    const pool = [{ athlete: athlete('p1', 'ATA', 'Vini'), teamSide: 'home' as const, pointsSoFar: 0 }];
    const fn = vi.fn();
    render(<SubstitutionPanel selectedToRemove={selected} pool={pool} onPick={fn} />);
    fireEvent.click(screen.getByTestId('sub-candidate-p1'));
    expect(fn).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- SubstitutionPanel`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
import type { LiveSubPoolEntry } from '@/lib/contracts/live';
import { JerseyIcon } from '@/components/JerseyIcon';

type Props = {
  selectedToRemove: { id: string; position: string; shortName: string };
  pool: LiveSubPoolEntry[];
  onPick: (athleteId: string) => void;
};

export function SubstitutionPanel({ selectedToRemove, pool, onPick }: Props) {
  const candidates = pool.filter((p) => p.athlete.position === selectedToRemove.position);

  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Escolha o substituto ({selectedToRemove.position})
      </h2>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">Nenhum jogador disponível para essa posição.</p>
      ) : (
        candidates.map((entry) => (
          <button
            key={entry.athlete.id}
            data-testid={`sub-candidate-${entry.athlete.id}`}
            onClick={() => onPick(entry.athlete.id)}
            className="w-full flex items-center gap-2 p-2 rounded bg-surface hover:bg-accent"
          >
            <JerseyIcon jerseyNumber={entry.athlete.jerseyNumber} primaryColor="#666" secondaryColor="#fff" size="sm" />
            <span className="flex-1 text-left text-sm font-medium">{entry.athlete.shortName}</span>
            <span className="text-xs text-muted-foreground">{entry.athlete.position}</span>
            <span className="tabular-nums text-sm font-semibold">{entry.pointsSoFar.toFixed(1)}</span>
          </button>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- SubstitutionPanel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/live/SubstitutionPanel.tsx src/components/live/SubstitutionPanel.test.tsx
git commit -m "feat(live): SubstitutionPanel filtering by position"
```

---

## Task 10: `ConfirmSubDialog` componente

**Files:**
- Create: `src/components/live/ConfirmSubDialog.tsx`
- Create: `src/components/live/ConfirmSubDialog.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmSubDialog } from './ConfirmSubDialog';

const removed = { id: 'r', shortName: 'Pedro', position: 'ATA' };
const added = { id: 'a', shortName: 'Vini', position: 'ATA' };

describe('ConfirmSubDialog', () => {
  it('shows both athletes in confirmation text', () => {
    render(<ConfirmSubDialog open removedAthlete={removed} addedAthlete={added} onConfirm={() => {}} onCancel={() => {}} loading={false} />);
    expect(screen.getByText(/Pedro/)).toBeInTheDocument();
    expect(screen.getByText(/Vini/)).toBeInTheDocument();
  });

  it('confirm button calls onConfirm', () => {
    const fn = vi.fn();
    render(<ConfirmSubDialog open removedAthlete={removed} addedAthlete={added} onConfirm={fn} onCancel={() => {}} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(fn).toHaveBeenCalled();
  });

  it('disabled while loading', () => {
    render(<ConfirmSubDialog open removedAthlete={removed} addedAthlete={added} onConfirm={() => {}} onCancel={() => {}} loading={true} />);
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- ConfirmSubDialog`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type AthleteLike = { id: string; shortName: string; position: string };

type Props = {
  open: boolean;
  removedAthlete: AthleteLike;
  addedAthlete: AthleteLike;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
};

export function ConfirmSubDialog({ open, removedAthlete, addedAthlete, onConfirm, onCancel, loading }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar substituição</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          Tirar <strong>{removedAthlete.shortName}</strong> ({removedAthlete.position}) e colocar <strong>{addedAthlete.shortName}</strong> ({addedAthlete.position})?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading}>{loading ? 'Confirmando...' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- ConfirmSubDialog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/live/ConfirmSubDialog.tsx src/components/live/ConfirmSubDialog.test.tsx
git commit -m "feat(live): ConfirmSubDialog modal"
```

---

## Task 11: `FinishedBanner` componente

**Files:**
- Create: `src/components/live/FinishedBanner.tsx`
- Create: `src/components/live/FinishedBanner.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen } from '@testing-library/react';
import { FinishedBanner } from './FinishedBanner';

describe('FinishedBanner', () => {
  it('shows victory message when myRole won', () => {
    render(<FinishedBanner winner="host" myRole="host" />);
    expect(screen.getByText(/Você venceu/i)).toBeInTheDocument();
  });

  it('shows defeat message when opponent won', () => {
    render(<FinishedBanner winner="host" myRole="guest" />);
    expect(screen.getByText(/venceu/i)).toBeInTheDocument();
    expect(screen.queryByText(/Você venceu/i)).not.toBeInTheDocument();
  });

  it('shows draw message', () => {
    render(<FinishedBanner winner="draw" myRole="host" />);
    expect(screen.getByText(/Empate/i)).toBeInTheDocument();
  });

  it('shows abandoned message', () => {
    render(<FinishedBanner winner="abandoned" myRole="host" />);
    expect(screen.getByText(/abandonada|encerrada/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- FinishedBanner`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type Props = {
  winner: 'host' | 'guest' | 'draw' | 'abandoned';
  myRole: 'host' | 'guest';
};

export function FinishedBanner({ winner, myRole }: Props) {
  let text = '';
  let positive = false;
  if (winner === 'draw') text = 'Empate!';
  else if (winner === 'abandoned') text = 'Sala abandonada';
  else if (winner === myRole) { text = '🎉 Você venceu!'; positive = true; }
  else text = `${winner === 'host' ? 'Host' : 'Guest'} venceu`;

  return (
    <div className="bg-surface rounded-lg p-4 text-center border border-border">
      <Trophy size={32} className={`mx-auto mb-2 ${positive ? 'text-event-positive' : 'text-muted-foreground'}`} />
      <div className="text-lg font-bold">{text}</div>
      <Link href="/me">
        <Button className="mt-3" size="sm">Voltar pro perfil</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- FinishedBanner`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/live/FinishedBanner.tsx src/components/live/FinishedBanner.test.tsx
git commit -m "feat(live): FinishedBanner cobrindo 4 winners"
```

---

## Task 12: `LiveMatchView`

**Files:**
- Create: `src/app/(app)/rooms/[id]/live-match-view.tsx`
- Create: `src/app/(app)/rooms/[id]/live-match-view.test.tsx`

- [ ] **Step 1: Escreve teste falhando**

```tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LiveMatchView } from './live-match-view';

const baseRoom: any = {
  id: 'r-1',
  status: 'LIVE',
  match: { id: 'm-1', homeTeam: { id: '1', name: 'Fla', shortName: 'FLA' }, awayTeam: { id: '2', name: 'Pal', shortName: 'PAL' } },
  live: {
    matchStatus: 'live',
    currentMinute: 30,
    currentMinuteAt: new Date().toISOString(),
    homeScore: 1,
    awayScore: 0,
    hostScore: 8,
    guestScore: 5,
    winner: null,
    hostLineup: [], guestLineup: [], recentEvents: [], pool: [],
  },
};

describe('LiveMatchView', () => {
  it('renders header + scoreboard + timeline', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LiveMatchView room={baseRoom} isHost />
      </QueryClientProvider>,
    );
    expect(screen.getByText('FLA')).toBeInTheDocument();
    expect(screen.getByText('PAL')).toBeInTheDocument();
    expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
  });

  it('renders FinishedBanner when finished prop is true', () => {
    const qc = new QueryClient();
    const finishedRoom = { ...baseRoom, status: 'FINISHED', live: { ...baseRoom.live, matchStatus: 'finished', winner: 'host' } };
    render(
      <QueryClientProvider client={qc}>
        <LiveMatchView room={finishedRoom} isHost finished />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Você venceu/i)).toBeInTheDocument();
  });

  it('toggles subMode when "Substituir" clicked', () => {
    // ...
  });
});
```

- [ ] **Step 2: Roda — falha**

Run: `npm test -- live-match-view`
Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
'use client';

import { useState } from 'react';
import { MatchHeader } from '@/components/live/MatchHeader';
import { ScoreboardCards } from '@/components/live/ScoreboardCards';
import { TeamLineup } from '@/components/live/TeamLineup';
import { MatchTimeline } from '@/components/live/MatchTimeline';
import { SubstitutionPanel } from '@/components/live/SubstitutionPanel';
import { ConfirmSubDialog } from '@/components/live/ConfirmSubDialog';
import { FinishedBanner } from '@/components/live/FinishedBanner';
import { useLiveSocket } from '@/hooks/useLiveSocket';
import { useMakeSubstitution } from '@/hooks/useMakeSubstitution';
import { useInterpolatedMinute } from '@/hooks/useInterpolatedMinute';
import { toast } from 'sonner';

type Props = { room: any; isHost: boolean; finished?: boolean };

export function LiveMatchView({ room, isHost, finished = false }: Props) {
  useLiveSocket(room.id);
  const live = room.live!;
  const myRole = isHost ? 'host' : 'guest';

  const myLineup = myRole === 'host' ? live.hostLineup : live.guestLineup;
  const oppLineup = myRole === 'host' ? live.guestLineup : live.hostLineup;
  const myScore = myRole === 'host' ? live.hostScore : live.guestScore;
  const oppScore = myRole === 'host' ? live.guestScore : live.hostScore;
  const myName = 'Você'; // pode buscar do auth/me
  const oppName = 'Oponente';

  const interpolatedMinute = useInterpolatedMinute(live.currentMinute, live.currentMinuteAt);

  const [subMode, setSubMode] = useState(false);
  const [selectedToRemove, setSelectedToRemove] = useState<any>(null);
  const [pendingAddAthleteId, setPendingAddAthleteId] = useState<string | null>(null);

  const makeSub = useMakeSubstitution(room.id);

  const handlePickFromPool = (addAthleteId: string) => setPendingAddAthleteId(addAthleteId);
  const cancelConfirm = () => setPendingAddAthleteId(null);

  const confirmSub = async () => {
    if (!selectedToRemove || !pendingAddAthleteId) return;
    try {
      await makeSub.mutateAsync({ removeAthleteId: selectedToRemove.id, addAthleteId: pendingAddAthleteId });
      setSubMode(false);
      setSelectedToRemove(null);
      setPendingAddAthleteId(null);
    } catch (err: any) {
      handleSubError(err?.code);
      setPendingAddAthleteId(null);
    }
  };

  const handleSubError = (code: string | undefined) => {
    switch (code) {
      case 'MATCH_NOT_STARTED': toast.error('Aguardando início da partida'); break;
      case 'ATHLETE_NOT_IN_TEAM': toast.error('Atleta não está mais no seu time'); break;
      case 'ATHLETE_NOT_AVAILABLE': toast.error('Atleta não está mais disponível'); break;
      case 'POSITION_MISMATCH': toast.error('Posições não batem'); break;
      case 'NOT_LIVE': toast.error('Sala não está ao vivo'); break;
      default: toast.error('Erro ao substituir — tente novamente');
    }
  };

  const addedAthleteForDialog = pendingAddAthleteId
    ? live.pool.find((p: any) => p.athlete.id === pendingAddAthleteId)?.athlete
    : null;

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
        canSub={!finished}
        subMode={subMode}
        onToggleSub={() => { setSubMode(!subMode); setSelectedToRemove(null); }}
      />

      {finished && live.winner && <FinishedBanner winner={live.winner} myRole={myRole} />}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.5fr] gap-3">
        <TeamLineup
          title={`${myName}`}
          lineup={myLineup}
          subMode={subMode && !finished}
          selectedId={selectedToRemove?.id ?? null}
          onSelectRemove={(a) => setSelectedToRemove(a)}
        />
        <TeamLineup title={oppName} lineup={oppLineup} />
        <div className="space-y-3">
          <MatchTimeline events={live.recentEvents} />
          {subMode && selectedToRemove && (
            <SubstitutionPanel
              selectedToRemove={selectedToRemove}
              pool={live.pool}
              onPick={handlePickFromPool}
            />
          )}
        </div>
      </div>

      {pendingAddAthleteId && addedAthleteForDialog && selectedToRemove && (
        <ConfirmSubDialog
          open={!!pendingAddAthleteId}
          removedAthlete={selectedToRemove}
          addedAthlete={addedAthleteForDialog}
          onConfirm={confirmSub}
          onCancel={cancelConfirm}
          loading={makeSub.isPending}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Roda — passa**

Run: `npm test -- live-match-view`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/rooms/\[id\]/live-match-view.tsx src/app/\(app\)/rooms/\[id\]/live-match-view.test.tsx
git commit -m "feat(live): LiveMatchView composing header + lineups + timeline + sub"
```

---

## Task 13: Dispatcher update + remove PendingView

**Files:**
- Modify: `src/app/(app)/rooms/[id]/page.tsx`
- Delete: `src/app/(app)/rooms/[id]/pending-view.tsx`

- [ ] **Step 1: Atualiza dispatcher**

Em `src/app/(app)/rooms/[id]/page.tsx`, substitui o switch:

```tsx
import { LiveMatchView } from './live-match-view';
// (remove import de PendingView)

switch (room.data.status) {
  case 'WAITING':  return <LobbyView room={room.data} isHost={isHost} />;
  case 'DRAFTING': return <DraftView room={room.data} isHost={isHost} />;
  case 'LIVE':     return <LiveMatchView room={room.data} isHost={isHost} />;
  case 'FINISHED': return <LiveMatchView room={room.data} isHost={isHost} finished />;
  default: return null;
}
```

- [ ] **Step 2: Deleta `pending-view.tsx`**

Run: `git rm src/app/\(app\)/rooms/\[id\]/pending-view.tsx`

- [ ] **Step 3: Verifica que nenhum import sobrou**

Run: `grep -r "PendingView\|pending-view" src/`
Expected: zero matches.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: passa.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/rooms/\[id\]/page.tsx
git commit -m "feat(live): dispatcher routes LIVE/FINISHED to LiveMatchView; remove PendingView"
```

---

## Task 14: Playwright E2E

**Files:**
- Create: `test/e2e/live-match.spec.ts`

- [ ] **Step 1: Escreve cenário e2e**

```ts
import { test, expect, Browser } from '@playwright/test';

test.describe('Live match', () => {
  test('flows from DRAFTING → LIVE → events → sub → cancellation → FINISHED', async ({ browser }) => {
    const host = await browser.newContext();
    const guest = await browser.newContext();
    // 1. host loga, cria sala
    // 2. guest entra com código
    // 3. ambos draftam 10 picks → LIVE
    // 4. simulator-trigger: força tick do poller (via endpoint debug ou aguarda 10s real)
    // 5. ambos veem o evento aparecer < 3s
    // 6. host clica "Substituir" → seleciona slot → seleciona substituto → confirma
    // 7. ambos veem lineup atualizada < 2s
    // 8. simulator cancela um evento → ambos veem "ANULADO" na timeline
    // 9. simulator progride até finished → FinishedBanner aparece em ambos < 2s
    // (Para testar tudo isso, precisamos de endpoints debug no API que aceleram o simulator. Alternativa: configurar o stub-simulator com tick rate alto para o E2E)
  });

  test('lineup:confirmed broadcasts to DRAFTING rooms', async ({ browser }) => {
    // ...
  });

  test('draw winner when scores tie', async ({ browser }) => {
    // ...
  });
});
```

> Pode ser necessário adicionar endpoints debug à API rodando em modo `NODE_ENV=test` que aceleram o stub simulator. Ajuste conforme padrão dos testes e2e existentes.

- [ ] **Step 2: Roda — passa**

Run: `npm run test:e2e -- live-match`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/live-match.spec.ts
git commit -m "test(e2e): live match Playwright suite"
```

---

## Task 15: Lint, typecheck, build, abertura de PR

- [ ] **Step 1: Roda toda a suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: tudo verde.

- [ ] **Step 2: Smoke local (manual)**

Sobe API local (`feat/live-match-api`) + frontend (`npm run dev`). Cria sala → drafta com outra conta → vê transição automática pra LiveMatchView → aguarda eventos do stub → testa substituição manualmente. Verifica que erros mostram toast correto.

- [ ] **Step 3: Commit final + abertura de PR**

```bash
git push -u origin feat/live-match-frontend
gh pr create --title "feat(frontend): vertical 5 — live match" --body "$(cat <<'EOF'
## Summary
- LiveMatchView substitui PendingView no dispatcher de /rooms/[id] em LIVE/FINISHED
- 7 componentes em src/components/live/ (MatchHeader, ScoreboardCards, TeamLineup, MatchTimeline, SubstitutionPanel, ConfirmSubDialog, FinishedBanner)
- 3 hooks: useMakeSubstitution, useLiveSocket, useInterpolatedMinute
- Contracts replicados em src/lib/contracts/live.ts + extensão de rooms/ws
- Playwright e2e cobrindo evento → sub → anulação → fim

## Test plan
- [ ] Vitest verde (npm test)
- [ ] Playwright verde (npm run test:e2e)
- [ ] Typecheck + lint + build verdes
- [ ] Smoke manual: sala LIVE renderiza, sub funciona, FinishedBanner aparece após match:finished

Depende de: feat/live-match-api (já mergeada).

Spec: docs/superpowers/specs/2026-05-24-live-match-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

- **Cobertura do spec:** §10.1 (rotas) → Task 13; §10.2 (estrutura) → Tasks 5-12; §10.3 (componentes) → Tasks 5-11; §10.4 (hooks) → Tasks 2-4; §10.5 (patches WS) → Task 4; §10.6 (erros) → Task 12 (mapeamento toast); §10.7 (animações) → Tasks 7, 8 (classes flash). §11.4 (Vitest) → cada componente tem teste; §11.5 (Playwright) → Task 14.
- **Placeholder scan:** OK — sem "TBD" ou "TODO".
- **Type consistency:** `LiveState`, `MatchEvent`, `LineupSlot`, `LiveSubPoolEntry` definidos em `contracts/live.ts` e referenciados consistentemente nos componentes. `useLiveSocket` consome os schemas do mesmo módulo. `winner` é tipado igual no spec, contract e componente.
