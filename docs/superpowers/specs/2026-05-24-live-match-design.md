# Vertical "Partida ao vivo" — Design

**Data:** 2026-05-24
**Vertical:** 5 do roadmap (live match — polling + scoring + substituições + UI)
**Status:** spec aprovada, aguardando plano de implementação
**Spec mestre relacionada:** [`2026-05-01-draft-duel-rebuild-design.md`](./2026-05-01-draft-duel-rebuild-design.md) §2.1–2.2, §5.4, §6.2, §7.2, §8
**Verticals anteriores:**
- [`2026-05-19-cartola-integration-design.md`](./2026-05-19-cartola-integration-design.md) (HybridStatsProvider)
- [`2026-05-23-draft-design.md`](./2026-05-23-draft-design.md) (LIVE entrypoint via `finalizeDraft`)

---

## 1. Resumo

Habilitar a fase **LIVE** de uma sala que acabou de sair do draft. Cobre o ciclo completo `DRAFTING → LIVE → FINISHED`:

- **Polling** de eventos da partida real via `LiveMatchPoller` (10s).
- **Scoring** puro em TypeScript via `scoring_rules` em DB.
- **Substituições** ilimitadas pelo modelo *ownership* (`room_lineup_intervals`).
- **Anulação de eventos** (VAR) via diff de scout cumulativo do Cartola.
- **UI completa** de partida ao vivo (scoreboard, lineups, timeline, sub dialog, finished banner).
- **Push automático** de `lineup:confirmed` para salas em DRAFTING.

A vertical assume que a sala chegou em LIVE com 10 `DraftPick`, 10 `RoomLineupInterval` abertos com `validFromMinute=0`, e WS/Socket.IO/Cookie auth/snapshot já estabelecidos (verticais 3 + 4). A `PendingView` placeholder é substituída pela `LiveMatchView`.

## 2. Decisões fixadas no brainstorm

| Tópico | Decisão | Motivo |
|---|---|---|
| Escopo | Vertical 5 = tudo (poll + scoring + subs + UI + LIVE→FINISHED + lineup push) | Última vertical antes do MVP. Deadline Copa 2026-06-11 — vale entregar o produto jogável de uma vez. |
| Stats provider | Estender `HybridStatsProvider.fetchMatchLive`: Cartola para Brasileirão, Stub para Copa | Cartola já está integrado para calendário; estende com `/atletas/pontuados/{rodada}`. |
| Polling | `@Cron('*/10 * * * * *')` + lock anti-reentrada | Spec mestre §8.5 já fixou 10s. Lock mantém single-instance correto. |
| Modo dev/CI | Stub simulador (5s real = 1min jogo) | Permite Playwright/E2E rodar fluxo completo em ~minuto sem rede. |
| Domínio do `ActionType` | Estender enum com 8 valores novos cobrindo todos os scouts do Cartola; provider traduz scout key → ActionType | Domínio agnóstico ao provider — futura troca é mecânica. |
| `AppliesTo` | Adicionar `BACK_LINE` (GOL+LAT+ZAG) para `CLEAN_SHEET` | `SG` no Cartola vale pra linha defensiva inteira, não só goleiro. |
| Scoring rules | Seed via migration com valores Cartola | Quem joga Cartola entende sem fricção. Tabela em DB — mudança não exige deploy. |
| Cancelamento (VAR) | Cartola publica scout cumulativo; diff `prev → current` → `-N` deleta MatchEvents (mais recentes do par `match+athlete+action`) | Modelo natural pro `recalculate` do zero. |
| Minuto do evento | Usa `currentMinute` do poll em que o scout apareceu | Cartola scout não publica minuto exato — limitação aceita; janela ~10s. |
| Empate | `winner='draw'` quando `hostScore === guestScore` no fim | Decisão de produto. |
| Postponed/Canceled | Poller detecta → sala `finished` + `winner='abandoned'` | Sem mecanismo de reschedule no MVP. |
| Pool de subs | Atletas do `match_lineups` que **não estejam em intervalo aberto** de nenhum role da sala, mesma posição | Replica protótipo: ciclo host troca → guest pega depois. |
| Substituições | Ilimitadas, ownership por intervalo | Spec mestre §2.1; modelo `room_lineup_intervals` já existe. |
| Lineup push WS | `LineupSyncWorker` emite evento interno → broadcast `lineup:confirmed` p/ todas as salas em DRAFTING daquele match | Remove botão manual da v4. |
| Concorrência | Validação otimista + tx atômica + recálculo pós-commit | Mesmo padrão de `RoomsService` / `DraftService`. |
| PRs | Dois paralelos: `feat/live-match-api`, `feat/live-match-frontend` | Padrão das verticais 2-4. |

## 3. Mudanças no schema (Prisma)

### 3.1 Extensão de `ActionType` (aditiva)

```prisma
enum ActionType {
  // Existentes (v1-v4)
  GOAL, ASSIST, YELLOW_CARD, RED_CARD,
  SAVE, PENALTY_SAVE, OWN_GOAL, PENALTY_MISS, PENALTY_GOAL,
  INTERCEPTION, TACKLE_WON, KEY_PASS, SHOT_ON_TARGET,
  // Cobertura de goleiro
  CLEAN_SHEET,       // SG
  HARD_SAVE,         // DD
  GOAL_CONCEDED,     // GS
  // Cobertura completa Cartola
  POST_HIT,          // FT
  MISSED_PASS,       // PE
  FOUL_SUFFERED,     // FF
  FOUL_COMMITTED,    // FS
  OFFSIDE,           // I
}
```

### 3.2 Extensão de `AppliesTo`

```prisma
enum AppliesTo {
  ALL
  GK
  FIELD
  BACK_LINE          // GOL + LAT + ZAG — NOVO
}
```

`ScoringService.appliesToPosition`:
- `ALL` → qualquer posição
- `GK` → só `GOL`
- `FIELD` → `LAT|ZAG|MEI|ATA` (tudo menos goleiro)
- `BACK_LINE` → `GOL|LAT|ZAG`

### 3.3 Mapeamento Cartola scout → `ActionType`

Tabela vive em `src/modules/stats/cartola/cartola.scout-map.ts`. Provider traduz; domínio nunca sabe que Cartola existe.

| Cartola | `ActionType` |
|---|---|
| `G` | `GOAL` |
| `A` | `ASSIST` |
| `CA` | `YELLOW_CARD` |
| `CV` | `RED_CARD` |
| `DEF` | `SAVE` |
| `DD` | `HARD_SAVE` |
| `DP` | `PENALTY_SAVE` |
| `SG` | `CLEAN_SHEET` |
| `GS` | `GOAL_CONCEDED` |
| `GC` | `OWN_GOAL` |
| `PP` | `PENALTY_MISS` |
| `RB` | `INTERCEPTION` |
| `DS` | `TACKLE_WON` |
| `FT` | `POST_HIT` |
| `PE` | `MISSED_PASS` |
| `FF` | `FOUL_SUFFERED` |
| `FS` | `FOUL_COMMITTED` |
| `I` | `OFFSIDE` |

Reservados pra providers futuros (Cartola não publica): `PENALTY_GOAL`, `KEY_PASS`, `SHOT_ON_TARGET`.

### 3.4 Seed `scoring_rules` (paridade Cartola)

| `action` | `points` | `applies_to` |
|---|---|---|
| `GOAL` | 8.0 | ALL |
| `ASSIST` | 5.0 | ALL |
| `YELLOW_CARD` | -2.0 | ALL |
| `RED_CARD` | -5.0 | ALL |
| `OWN_GOAL` | -5.0 | ALL |
| `PENALTY_MISS` | -4.0 | ALL |
| `PENALTY_GOAL` | 10.0 | ALL |
| `FOUL_SUFFERED` | 0.5 | ALL |
| `FOUL_COMMITTED` | -0.5 | ALL |
| `OFFSIDE` | -0.5 | FIELD |
| `POST_HIT` | 3.5 | FIELD |
| `INTERCEPTION` | 1.5 | FIELD |
| `TACKLE_WON` | 1.2 | FIELD |
| `KEY_PASS` | 1.5 | FIELD |
| `SHOT_ON_TARGET` | 1.0 | FIELD |
| `MISSED_PASS` | -0.3 | FIELD |
| `SAVE` | 1.0 | GK |
| `HARD_SAVE` | 3.0 | GK |
| `PENALTY_SAVE` | 7.0 | GK |
| `GOAL_CONCEDED` | -2.0 | GK |
| `CLEAN_SHEET` | 5.0 | BACK_LINE |

### 3.5 Mudanças no `Match`

```prisma
model Match {
  // ...campos existentes
  lastScoutSnapshot Json @default("{}") @map("last_scout_snapshot")
  scoutSequence     Int  @default(0)    @map("scout_sequence")
}
```

- `lastScoutSnapshot`: `Record<athleteExternalId, Record<ActionType, number>>`. Estado do **último scout cumulativo** que o provider devolveu — diff vs próximo poll deriva eventos novos/cancelados. É um detalhe do provider Cartola (provider futuro com eventos discretos ignora).
- `scoutSequence`: contador monotônico pra gerar `provider_external_id` único nos `MatchEvent` (`cartola-${matchExternalId}-${athleteId}-${action}-${seq}`).

### 3.6 Índice novo

```sql
CREATE INDEX idx_match_events_match_athlete
  ON match_events (match_id, athlete_id);
```

Acelera o JOIN do `ScoringService.recalculate` (events × intervals por `athlete_id`).

### 3.7 Migrations — duas files

Postgres não permite usar valor de enum recém-adicionado na mesma transação. Quebra em duas migrations consecutivas:

**`20260524000000_extend_enums`** (só extensão):

```sql
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'CLEAN_SHEET';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'HARD_SAVE';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'GOAL_CONCEDED';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'POST_HIT';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'MISSED_PASS';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'FOUL_SUFFERED';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'FOUL_COMMITTED';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'OFFSIDE';
ALTER TYPE "AppliesTo" ADD VALUE IF NOT EXISTS 'BACK_LINE';
```

**`20260524000001_live_match_setup`** (consome os novos valores):

```sql
ALTER TABLE matches
  ADD COLUMN last_scout_snapshot JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN scout_sequence INT NOT NULL DEFAULT 0;

CREATE INDEX idx_match_events_match_athlete
  ON match_events (match_id, athlete_id);

INSERT INTO scoring_rules (action, points, applies_to) VALUES
  ('GOAL', 8.0, 'ALL'),
  ('ASSIST', 5.0, 'ALL'),
  ('YELLOW_CARD', -2.0, 'ALL'),
  ('RED_CARD', -5.0, 'ALL'),
  ('OWN_GOAL', -5.0, 'ALL'),
  ('PENALTY_MISS', -4.0, 'ALL'),
  ('PENALTY_GOAL', 10.0, 'ALL'),
  ('FOUL_SUFFERED', 0.5, 'ALL'),
  ('FOUL_COMMITTED', -0.5, 'ALL'),
  ('OFFSIDE', -0.5, 'FIELD'),
  ('POST_HIT', 3.5, 'FIELD'),
  ('INTERCEPTION', 1.5, 'FIELD'),
  ('TACKLE_WON', 1.2, 'FIELD'),
  ('KEY_PASS', 1.5, 'FIELD'),
  ('SHOT_ON_TARGET', 1.0, 'FIELD'),
  ('MISSED_PASS', -0.3, 'FIELD'),
  ('SAVE', 1.0, 'GK'),
  ('HARD_SAVE', 3.0, 'GK'),
  ('PENALTY_SAVE', 7.0, 'GK'),
  ('GOAL_CONCEDED', -2.0, 'GK'),
  ('CLEAN_SHEET', 5.0, 'BACK_LINE')
ON CONFLICT (action) DO UPDATE
  SET points = EXCLUDED.points,
      applies_to = EXCLUDED.applies_to;
```

Tudo aditivo, sem dropar nada.

## 4. Arquitetura geral

```
┌──────────────────────────────────────────────────────────────┐
│  LiveMatchPoller @Cron('*/10 * * * * *')                      │
│   1. find pollable matches (LIVE, ±5min do kickoff, 5min      │
│      buffer pós-finished)                                     │
│   2. HybridStatsProvider.fetchMatchLive(externalId)           │
│   3. p/ cada match: orchestrator.applyLiveData(match, live)   │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
        ┌──────────────────────────────────────┐
        │  MatchOrchestratorService            │
        │   • applyLiveData(match, live)       │
        │   • applySubstitution(input, user)   │
        │   • closeRoom(roomId, status, min)   │
        │   • openInitialIntervals(...)        │ (já existe, v4)
        └──────────────────────────┬───────────┘
                                   ▼
            ┌──────────────────────────────────┐
            │ ScoringService                   │
            │   recalculate(roomId)            │
            │   → computeScore(intervals,      │
            │     events, rules) (pure)        │
            └──────────────────────────────────┘
                                   │
                                   ▼
                  EventEmitter → WsGateway @OnEvent
                  → broadcast `room:<id>`
```

**Princípios preservados** (spec mestre §4.1):
- Postgres autoritativo. Cliente nunca escreve direto. WS apenas transporta intenções (`match:substitute`); backend valida, persiste, broadcasta.
- API stateless. `lastScoutSnapshot` persistido em `Match` (sobrevive a restart).
- Diff-based broadcast. Polling derivado de diff vs snapshot — re-runs são no-ops.
- StatsProvider abstrato. Cartola map vive no provider; domínio é agnóstico.
- Função pura de scoring. `computeScore` é testável sem DB.

## 5. Módulos da API

### 5.1 `src/modules/match/` — conteúdo novo

```
match/
├── match.module.ts
├── match-orchestrator.service.ts                       (applyLiveData, applySubstitution, closeRoom, + openInitialIntervals já existente)
├── match-orchestrator.service.spec.ts                  (unit, Prisma mockado)
├── match-orchestrator.service.integration.spec.ts     (race + atomicidade)
├── scoring/
│   ├── scoring.service.ts                              (carrega + delega pra função pura)
│   ├── scoring.service.spec.ts
│   ├── compute-score.ts                                (função pura)
│   ├── compute-score.spec.ts                           (fixtures: 1 atleta, 1 sub, anulação, BACK_LINE)
│   └── applies-to-position.ts
├── diff-scouts/
│   ├── diff-scouts.ts                                  (função pura — added, removed, newSnapshot)
│   └── diff-scouts.spec.ts
├── mappers/
│   ├── live-state-mapper.ts                            (Prisma rows → LiveStateDto)
│   └── live-state-mapper.spec.ts
├── enums/
│   ├── match-event.enum.ts                             (NEW, CANCELED, TICK, SUBSTITUTION_APPLIED, FINISHED, LINEUP_CONFIRMED)
│   └── match-error-code.enum.ts                        (estende WsErrorCode)
└── dto/
    ├── match-live.dto.ts                               (input do provider)
    ├── live-state.dto.ts                               (output do snapshot)
    ├── match-event.dto.ts
    ├── lineup-slot.dto.ts
    └── live-sub-pool-entry.dto.ts
```

### 5.2 `src/modules/workers/` — `LiveMatchPoller`

```
workers/
├── live-match-poller.ts                                (@Cron + lock)
└── live-match-poller.spec.ts
```

### 5.3 `src/modules/stats/` — extensão

- `stats-provider.ts`: adiciona `fetchMatchLive` à interface.
- `cartola/cartola.scout-map.ts` (novo): tabela `CARTOLA_SCOUT_MAP: Record<string, ActionType>`.
- `cartola/cartola-stats.provider.ts`: implementa `fetchMatchLive` consumindo `/atletas/pontuados/{rodada}`; traduz scout keys → ActionType; ignora keys sem mapeamento (log debug).
- `stub-stats.provider.ts`: `fetchMatchLive` em modo simulador (5s real = 1min jogo).
- `hybrid-stats.provider.ts`: roteia `fetchMatchLive` por prefixo do external_id (`cartola-*` vs `stub-*`).

### 5.4 `src/modules/rooms/` — extensão de `getSnapshot`

`RoomsService.getSnapshot()` ganha load extra (intervals + events recentes + pool) quando `status === LIVE` ou `FINISHED`. Mapper compõe `LiveStateDto`. Sem mudança no shape externo do método — campo `live` populado quando aplicável.

### 5.5 `LineupSyncWorker` — emissão de evento interno

Quando o worker (15min) confirma uma escalação que antes era `null`, emite `MatchEvent.LINEUP_CONFIRMED { matchId, hostLineup, guestLineup }`. `WsGateway` ouve e broadcasta `lineup:confirmed` pra todas as salas em DRAFTING daquele match.

### 5.6 `WsModule` — handlers e listeners

- Handler `match:substitute { roomId, removeAthleteId, addAthleteId }` → valida Zod → `MatchOrchestratorService.applySubstitution` → ack.
- `@OnEvent` para os 6 tópicos do `match` + `lineup:confirmed`. Broadcast no canal `room:<id>` (exceto `lineup:confirmed`, que é broadcasted no canal `match:<matchId>` ou direto pra cada `room:<id>` afetada — escolha de implementação).

## 6. Contratos — DTOs e schemas Zod

### 6.1 Provider — `MatchLiveDto`

```ts
type MatchLiveDto = {
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'canceled'
  currentMinute: number | null
  homeScore: number | null
  awayScore: number | null
  athleteScouts: AthleteScoutSnapshot[]
}

type AthleteScoutSnapshot = {
  athleteExternalId: string
  scout: Partial<Record<ActionType, number>>   // counts cumulativos (provider já traduziu)
}
```

### 6.2 Extensão do `RoomSnapshotDto`

```ts
type RoomSnapshot = {
  // ...campos existentes (v3 + v4)
  draft: DraftStateDto | null
  live: LiveStateDto | null    // ← NOVO; populado em LIVE/FINISHED
}

type LiveStateDto = {
  matchStatus: MatchStatus               // 'live' | 'finished' | 'postponed' | 'canceled'
  currentMinute: number | null
  currentMinuteAt: string | null         // ISO; cliente interpola entre ticks
  homeScore: number | null
  awayScore: number | null
  hostScore: number                      // placar da SALA (nosso scoring)
  guestScore: number
  winner: 'host' | 'guest' | 'draw' | 'abandoned' | null
  hostLineup: LineupSlotDto[]            // 5 slots atuais do host (após subs)
  guestLineup: LineupSlotDto[]
  recentEvents: MatchEventDto[]          // últimos 50 eventos, mais novos primeiro
  pool: LiveSubPoolEntryDto[]            // atletas fora dos 2 times — candidatos a sub
}

type LineupSlotDto = {
  athlete: AthleteRefDto
  cumulativePoints: number               // pontos do atleta enquanto esteve no role
}

type MatchEventDto = {
  id: string                             // UUID; usado pra animação/dedup
  athlete: AthleteRefDto
  action: ActionType
  minute: number
  points: number                         // positivo (marcação) ou negativo (anulação)
  affectedRole: Role | null
  canceled: boolean
}

type LiveSubPoolEntryDto = {
  athlete: AthleteRefDto
  teamSide: 'home' | 'away'
  pointsSoFar: number                    // pontos acumulados do atleta na partida
}
```

### 6.3 WebSocket — eventos do live

**Cliente → Server:**

| Evento | Payload (Zod) | Resposta |
|---|---|---|
| `match:substitute` | `{ roomId: uuid, removeAthleteId: uuid, addAthleteId: uuid }` | ack `{ ok: true }` ou `WsException` com `code: WsErrorCode` |

**Server → broadcast `room:<id>`:**

| Evento | Payload | Quando |
|---|---|---|
| `match:event` | `{ event: MatchEventDto, hostScore, guestScore }` | Poller derivou novo evento de scout (não-anulação). |
| `match:event_canceled` | `{ eventId, athleteId, action, minute, points, affectedRole, hostScore, guestScore }` | Cartola decrementou scout (VAR anulou). |
| `match:tick` | `{ currentMinute, currentMinuteAt, homeScore, awayScore }` | Cada poll com mudança em minute ou placar real (sem novos eventos). |
| `match:substitution_applied` | `{ role, removedAthlete, addedAthlete, minute, hostScore, guestScore, hostLineup, guestLineup }` | Sub aplicada com sucesso. |
| `match:finished` | `{ hostScore, guestScore, winner, finishedAt }` | Poller detectou `status='finished'` (ou postponed/canceled — `winner='abandoned'`). |
| `lineup:confirmed` | `{ matchId, hostLineup?, guestLineup? }` | `LineupSyncWorker` confirmou escalação enquanto sala estava em DRAFTING. |

### 6.4 Tabela canônica de erros WS (extensão)

| Cenário | `code` | Disconnect? |
|---|---|---|
| Payload inválido (Zod falha) | `VALIDATION` | não |
| Sala não existe | `ROOM_NOT_FOUND` | não |
| User não é membro | `NOT_MEMBER` | sim |
| Sala não está em LIVE | `NOT_LIVE` | não — cliente re-sync |
| `currentMinute=null` (pré-kickoff) | `MATCH_NOT_STARTED` | não |
| `removeAthleteId` não está em intervalo aberto do role | `ATHLETE_NOT_IN_TEAM` | não — cliente re-sync |
| `addAthleteId` não disponível (não está no match ou já em uso) | `ATHLETE_NOT_AVAILABLE` | não — cliente re-sync |
| Posições não batem | `POSITION_MISMATCH` | não |
| Erro interno inesperado | `INTERNAL` | não |

## 7. Lógica do `LiveMatchPoller`

### 7.1 `tick()` com lock

```ts
@Cron('*/10 * * * * *')
async tick(): Promise<void> {
  if (this.lock.isLocked()) return
  await this.lock.runExclusive(() => this.runCycle())
}
```

### 7.2 `findPollable()`

```sql
SELECT m.* FROM matches m
WHERE
  m.status = 'LIVE'
  OR (m.status = 'SCHEDULED' AND m.kickoff_at BETWEEN now() - interval '5 min' AND now() + interval '5 min')
  OR (m.status = 'FINISHED' AND m.updated_at > now() - interval '5 min')
ORDER BY m.kickoff_at;
```

5min de buffer pós-FINISHED cobre correções tardias de scout pelo provider.

### 7.3 `runCycle()`

```ts
async runCycle(): Promise<void> {
  const matches = await this.matchesRepo.findPollable()
  if (matches.length === 0) return

  const results = await Promise.allSettled(
    matches.map((m) => this.stats.fetchMatchLive(m.externalId))
  )

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const r = results[i]
    if (r.status === 'rejected') {
      this.log.warn({ matchId: match.id, err: r.reason?.message }, 'match.poll.failed')
      continue
    }
    try {
      await this.orchestrator.applyLiveData(match, r.value)
    } catch (err) {
      this.log.error({ matchId: match.id, err }, 'applyLiveData failed')
    }
  }
}
```

`Promise.allSettled` isola falhas por match. Falha de sala (dentro do orchestrator) é isolada por try/catch.

## 8. Lógica do `MatchOrchestratorService`

### 8.1 `applyLiveData(match, live)`

```ts
async applyLiveData(match: Match, live: MatchLiveDto): Promise<void> {
  // 1. Diff de scout
  const { added, removed, newSnapshot } = diffScouts(match.lastScoutSnapshot, live.athleteScouts)
  const wantsClose = ['finished', 'postponed', 'canceled'].includes(live.status)

  // 2. Tx: insere/deleta MatchEvents + atualiza Match (snapshot, sequence, minute, scores, status)
  const { insertedEvents, deletedEvents } = await this.prisma.$transaction(async (tx) => {
    let nextSeq = match.scoutSequence
    const insertedEvents: MatchEvent[] = []
    for (const a of added) {
      // resolve athleteExternalId → athleteId; ignora se atleta desconhecido
      const athleteId = await this.resolveAthlete(tx, match.id, a.athleteExternalId)
      if (!athleteId) continue
      for (let k = 0; k < a.count; k++) {
        nextSeq += 1
        const evt = await tx.matchEvent.create({
          data: {
            matchId: match.id,
            athleteId,
            action: a.action,
            minute: live.currentMinute ?? 0,
            occurredAt: new Date(),
            providerExternalId: `cartola-${match.externalId}-${a.athleteExternalId}-${a.action}-${nextSeq}`,
            rawPayload: a.raw,
          },
        })
        insertedEvents.push(evt)
      }
    }

    const deletedEvents: MatchEvent[] = []
    for (const r of removed) {
      const athleteId = await this.resolveAthlete(tx, match.id, r.athleteExternalId)
      if (!athleteId) continue
      const candidates = await tx.matchEvent.findMany({
        where: { matchId: match.id, athleteId, action: r.action },
        orderBy: { providerExternalId: 'desc' },
        take: r.count,
      })
      if (candidates.length < r.count) throw new ScoutInvariantError(...)
      await tx.matchEvent.deleteMany({ where: { id: { in: candidates.map((c) => c.id) } } })
      deletedEvents.push(...candidates)
    }

    await tx.match.update({
      where: { id: match.id },
      data: {
        status: mapMatchStatus(live.status),
        currentMinute: live.currentMinute,
        homeScore: live.homeScore,
        awayScore: live.awayScore,
        lastScoutSnapshot: newSnapshot,
        scoutSequence: nextSeq,
      },
    })

    return { insertedEvents, deletedEvents }
  })

  // 3. Pra cada sala live nesse match: recalcula + broadcast
  const liveRooms = await this.roomsRepo.findLiveByMatch(match.id)
  if (insertedEvents.length === 0 && deletedEvents.length === 0 && !wantsClose) {
    this.broadcastTick(liveRooms, live)
    return
  }
  for (const room of liveRooms) {
    await this.processRoomEvents(room, insertedEvents, deletedEvents, live)
  }

  // 4. Fim de jogo
  if (wantsClose) {
    for (const room of liveRooms) {
      await this.closeRoom(room.id, 'FINISHED', live.currentMinute ?? 0, live.status)
    }
  }
}
```

### 8.2 `diffScouts` — função pura

```ts
function diffScouts(
  prev: Record<string, Partial<Record<ActionType, number>>>,
  current: AthleteScoutSnapshot[],
): { added: ScoutDelta[], removed: ScoutDelta[], newSnapshot: typeof prev } {
  const added: ScoutDelta[] = []
  const removed: ScoutDelta[] = []
  const newSnapshot = { ...prev }

  for (const { athleteExternalId, scout } of current) {
    const prevScout = prev[athleteExternalId] ?? {}
    for (const [actionKey, currentCount] of Object.entries(scout)) {
      const action = actionKey as ActionType
      const prevCount = prevScout[action] ?? 0
      const diff = currentCount - prevCount
      if (diff > 0) added.push({ athleteExternalId, action, count: diff })
      else if (diff < 0) removed.push({ athleteExternalId, action, count: -diff })
    }
    // Chave que sumiu do current — anular contagem prévia
    for (const [actionKey, prevCount] of Object.entries(prevScout)) {
      const action = actionKey as ActionType
      if (!(action in scout) && prevCount > 0) {
        removed.push({ athleteExternalId, action, count: prevCount })
      }
    }
    newSnapshot[athleteExternalId] = { ...scout }
  }

  return { added, removed, newSnapshot }
}
```

### 8.3 `applySubstitution(input, user)` — validações

1. **Sala + membership** — `RoomsService.assertMembership(roomId, userId)`. Erro: `ROOM_NOT_FOUND` / `NOT_MEMBER`.
2. **Sala em LIVE** — `NOT_LIVE` se diferente.
3. **Match com kickoff** — `match.currentMinute === null` → `MATCH_NOT_STARTED`.
4. **`removeAthleteId` está em intervalo aberto do role do user** — `roomLineupInterval.findFirst({ roomId, role: myRole, athleteId: removeAthleteId, validToMinute: null })`. Erro: `ATHLETE_NOT_IN_TEAM`.
5. **`addAthleteId` disponível** —
   - Está em `match_lineups` da partida (qualquer `isStarter`).
   - Não tem intervalo aberto em nenhum role da sala. Erro: `ATHLETE_NOT_AVAILABLE`.
6. **Posição bate** — `addAthlete.position !== removeAthlete.position` → `POSITION_MISMATCH`.

### 8.4 Tx atômica + recálculo pós-commit

```ts
const minute = match.currentMinute!     // garantido != null pela validação 3

await this.prisma.$transaction(async (tx) => {
  await tx.roomLineupInterval.update({ where: { id: openInterval.id }, data: { validToMinute: minute } })
  await tx.roomLineupInterval.create({ data: { roomId, role: myRole, athleteId: addAthleteId, validFromMinute: minute, validToMinute: null } })
  await tx.substitution.create({ data: { roomId, role: myRole, removedAthleteId, addedAthleteId, appliedAtMinute: minute, appliedAt: new Date() } })
})

const { hostScore, guestScore } = await this.scoring.recalculate(roomId)
await this.prisma.room.update({ where: { id: roomId }, data: { hostScore, guestScore } })

this.eventEmitter.emit(MatchEvent.SUBSTITUTION_APPLIED, { roomId, role: myRole, removedAthlete, addedAthlete, minute, hostScore, guestScore })
```

### 8.5 `closeRoom(roomId, endStatus, endMinute, liveStatus)`

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.roomLineupInterval.updateMany({
    where: { roomId, validToMinute: null },
    data: { validToMinute: endMinute },
  })
  const { hostScore, guestScore } = await this.scoring.recalculate(roomId)
  const winner = liveStatus === 'finished'
    ? (hostScore > guestScore ? 'host' : guestScore > hostScore ? 'guest' : 'draw')
    : 'abandoned'
  await tx.room.update({
    where: { id: roomId },
    data: { status: 'FINISHED', hostScore, guestScore, winner, matchFinishedAt: new Date() },
  })
})

this.eventEmitter.emit(MatchEvent.FINISHED, { roomId, hostScore, guestScore, winner, finishedAt })
```

Idempotente: rodar 2x consecutivas gera state final igual; reemissão tratada como reconcile no cliente.

## 9. `ScoringService` (função pura)

```ts
export function computeScore(
  intervals: IntervalWithAthlete[],
  events: MatchEvent[],
  rules: ScoringRule[],
): RoomScore {
  const ruleMap = new Map(rules.map((r) => [r.action, r]))
  const breakdown: PerAthleteBreakdown = {}
  let hostScore = 0
  let guestScore = 0

  for (const evt of events) {
    const rule = ruleMap.get(evt.action)
    if (!rule) continue
    for (const interval of intervals) {
      if (interval.athleteId !== evt.athleteId) continue
      if (evt.minute < interval.validFromMinute) continue
      if (interval.validToMinute !== null && evt.minute >= interval.validToMinute) continue
      if (!appliesToPosition(rule.appliesTo, interval.athlete.position)) continue

      const pts = Number(rule.points)
      if (interval.role === 'HOST') hostScore += pts
      else guestScore += pts

      const key = `${interval.role}:${evt.athleteId}`
      breakdown[key] = (breakdown[key] ?? 0) + pts
    }
  }

  return { hostScore: round2(hostScore), guestScore: round2(guestScore), breakdown }
}
```

**Características:**
- Pura — input determina output. Testável com fixtures pequenas.
- Sem otimização prematura: O(events × intervals). 200 eventos × 10 intervals = 2k ops, negligível.
- `round2` evita acumular erro de float.
- `perAthleteBreakdown` alimenta `LineupSlotDto.cumulativePoints` na UI.

`scoring_rules` cacheada em processo (carregada em `OnModuleInit` ou cache TTL 5min). Sem invalidação ativa — mudança de regra exige restart (aceitável no MVP).

## 10. Frontend

### 10.1 Rotas

Sem rota nova. `/rooms/[id]` dispatcher atualizado:

```tsx
switch (room.data.status) {
  case 'WAITING':  return <LobbyView      ... />
  case 'DRAFTING': return <DraftView      ... />
  case 'LIVE':     return <LiveMatchView  room={room.data} isHost={isHost} />
  case 'FINISHED': return <LiveMatchView  room={room.data} isHost={isHost} finished />
}
```

`PendingView` removido (LIVE/FINISHED têm UI real agora).

### 10.2 Estrutura

```
src/app/(app)/rooms/[id]/
├── page.tsx
├── lobby-view.tsx
├── draft-view.tsx
├── live-match-view.tsx          ← NOVO
└── live-match-view.test.tsx     ← NOVO

src/components/live/             ← NOVO
├── MatchHeader.tsx
├── ScoreboardCards.tsx
├── TeamLineup.tsx
├── MatchTimeline.tsx
├── SubstitutionPanel.tsx
├── ConfirmSubDialog.tsx
└── FinishedBanner.tsx

src/hooks/
├── useMakeSubstitution.ts       ← NOVO
├── useLiveSocket.ts             ← NOVO
└── useInterpolatedMinute.ts     ← NOVO

src/lib/contracts/
└── live.ts                      ← NOVO (espelho Zod)
```

### 10.3 Componentes

| Componente | Responsabilidade |
|---|---|
| `MatchHeader` | Nome dos times + placar real + indicador "AO VIVO" + minuto interpolado |
| `ScoreboardCards` | 2 cards (você vs oponente). Verde no card vencendo. Banner "🔄 Sub disponível" no meu |
| `TeamLineup` | 5 slots ordenados por POSITION_ORDER, com JerseyIcon + pontos cumulativos. Botão "Substituir" no meu time |
| `MatchTimeline` | Lista cronológica (~50 últimos). Minuto + ação + sinal de pontos. "ANULADO" pra cancelados |
| `SubstitutionPanel` | 2 fases: seleciona meu atleta → mostra pool filtrada por posição com `pointsSoFar` |
| `ConfirmSubDialog` | Modal shadcn confirmando "Tirar @X (POS) e colocar @Y (POS)?" |
| `FinishedBanner` | Trophy + texto por winner (4 casos). Botão "Voltar pro perfil" |

### 10.4 Hooks

| Hook | Função |
|---|---|
| `useMakeSubstitution(roomId)` | Mutation que emite `match:substitute` via socket + aguarda ack. Expõe `error.code` |
| `useLiveSocket(roomId)` | Listeners de 6 eventos WS → `setQueryData(['room', roomId])`. Usa singleton |
| `useInterpolatedMinute(serverMinute, serverMinuteAt)` | `setInterval(1000ms)` calcula `minute + ⌊(now - serverMinuteAt) / 60s⌋` |

### 10.5 Patches no cache (mesma estratégia v3/v4)

| Evento | Patch |
|---|---|
| `match:event` | Append em `live.recentEvents` (cap 50). Atualiza scores. Bump `cumulativePoints` no slot afetado. Flash visual |
| `match:event_canceled` | Append com `canceled=true` + sinal negativo. Invalida query (refetch snapshot pra reconcile total) |
| `match:tick` | Atualiza minute/minuteAt/homeScore/awayScore. Sem efeito em score da sala |
| `match:substitution_applied` | Substitui slot do role afetado. Atualiza pool. Atualiza scores. Toast se foi oponente |
| `match:finished` | Troca `status` pra `FINISHED`. Popula `winner`. Dispatcher renderiza com `finished=true` |
| `lineup:confirmed` (em DRAFTING) | Atualiza `room.match.lineupsConfirmedAt` + `draft.pool`. Re-renderiza DraftView com `lineupReady=true` |

### 10.6 Erros — mapeamento UX

| WsErrorCode | UX |
|---|---|
| `NOT_LIVE` | Re-sync (snapshot stale) |
| `MATCH_NOT_STARTED` | Toast "Aguardando início da partida" |
| `ATHLETE_NOT_IN_TEAM` | Toast "Atleta não está mais no seu time" + re-sync |
| `ATHLETE_NOT_AVAILABLE` | Toast "Atleta não está mais disponível" + re-sync |
| `POSITION_MISMATCH` | Toast "Posições não batem" (raro — UI já filtra) |
| `NOT_MEMBER` / `ROOM_NOT_FOUND` | Redireciona pra `/me` |
| `VALIDATION` / `INTERNAL` | Toast genérico |

### 10.7 Animações

| Trigger | Efeito |
|---|---|
| Evento positivo no slot | Flash verde + "+8.0" animado |
| Evento negativo | Flash vermelho |
| Evento cancelado | Flash amarelo + "ANULADO" |
| Score muda | Tween numérico (Framer Motion) |
| Sub aplicada | Slot velho fade-out, novo fade-in |
| Match finished | Trophy zoom-in |

Reusa classes Tailwind já existentes (`animate-flash-positive`, etc.).

## 11. Estratégia de testes

### 11.1 API — Unit

| Arquivo | Cobertura |
|---|---|
| `compute-score.spec.ts` | 1 atleta + 1 gol, antes/depois de sub, CLEAN_SHEET BACK_LINE (vale pra GOL/LAT/ZAG, não pra MEI/ATA), GOAL_CONCEDED só GOL, evento fora do intervalo, atleta com 2 intervalos disjuntos |
| `diff-scouts.spec.ts` | added, removed, chave sumindo, multi-atleta, multi-action no mesmo atleta |
| `applies-to-position.spec.ts` | 4 valores × 5 posições |
| `scoring.service.spec.ts` | `recalculate` carrega via Prisma mockado, delega pra `computeScore`, persiste em rooms |
| `match-orchestrator.service.spec.ts` | `applyLiveData` happy + anulação + finished; cada erro de `applySubstitution` |
| `live-match-poller.spec.ts` | Lock previne reentrada; `Promise.allSettled` isola falha; `findPollable` query |
| `cartola-stats.provider.spec.ts` (estende) | `fetchMatchLive` traduz scout keys; drops desconhecidos com log |
| `stub-stats.provider.simulator.spec.ts` | Simulador progride 5s real = 1min jogo + cenário de anulação |
| `ws.gateway.spec.ts` (estende) | Handler `match:substitute` + 6 listeners broadcastam corretamente |
| `live-state-mapper.spec.ts` | Sala LIVE/FINISHED → `live` populado; WAITING/DRAFTING → null |

### 11.2 API — Integration (Testcontainers Postgres)

| Arquivo | Cenários |
|---|---|
| `match-orchestrator.integration.spec.ts` | `applyLiveData` end-to-end com snapshot diff; cancelamento; multi-sala; race de sub do mesmo user; race de sub p/ mesmo `addAthleteId`; `closeRoom` idempotente |
| `scoring.integration.spec.ts` | Cenário com 10 atletas, 1 sub no min 30, 5 eventos antes + 5 depois |
| `live-match-poller.integration.spec.ts` | Stub simulador + sala drafted → 3 ciclos → score progride → fim |

### 11.3 API — E2E

`test/e2e/live-match.e2e-spec.ts`:
- Setup: match + sala drafted + stub simulador
- Eventos: cada poll dispara `match:tick` ou `match:event` → ambos clientes recebem
- Sub: emit + ack <1s + broadcast <2s
- Anulação: stub configura scout retrocedendo → `match:event_canceled` recebido
- Lineup push: trigger manual do worker → `lineup:confirmed` chega
- Fim: simulador → `match:finished` + DB tem winner correto
- Postponed: `winner='abandoned'`
- Empate: `winner='draw'`

### 11.4 Frontend — Vitest

- `useMakeSubstitution`, `useLiveSocket`, `useInterpolatedMinute` (3 specs)
- `live-match-view` (dispatcher + integração)
- 6 specs de componente

### 11.5 Frontend — Playwright

`test/e2e/live-match.spec.ts`: 2 contexts, mock API com stub simulador, fluxo evento → sub → anulação → fim.

### 11.6 Cobertura mínima

| Item | Unit | Integration | E2E |
|---|---|---|---|
| `computeScore` happy + edge | ✓ | ✓ | ✓ |
| `diffScouts` | ✓ | ✓ | implícito |
| `applyLiveData` happy + anulação | ✓ | ✓ | ✓ |
| `applySubstitution` happy + erros | ✓ | parcial (races) | ATHLETE_NOT_IN_TEAM + outros |
| `closeRoom` 3 estados | ✓ | ✓ | finished + postponed |
| Empate | ✓ | ✓ | ✓ |
| Stub simulador | ✓ | ✓ | ✓ |
| Cartola scout mapping | ✓ | — | implícito |
| Lineup push WS | ✓ gateway | ✓ | ✓ |
| Broadcast WS (5 tópicos) | ✓ | ✓ | ✓ |
| Snapshot enriquecido | ✓ mappers | ✓ | implícito |
| Frontend FinishedBanner | ✓ | — | ✓ |
| Interpolated minute | ✓ | — | implícito |

## 12. Edge cases

1. **Atleta entra/sai do lineup mid-match.** `LineupSyncWorker` (15min) eventualmente refletindo. Atleta removido do lineup fica fora do pool de subs.
2. **CLEAN_SHEET no minuto 89, gol no 90+3.** Cartola publica `SG=1` → `SG=0`. `diffScouts` cancela; score recalcula corretamente.
3. **Match volta de finished pra live.** Buffer 5min pós-FINISHED no `findPollable`. Mas `closeRoom` é one-way — sala não reabre. Aceito.
4. **Cookie expira mid-live.** Padrão v3/v4: refresh → reconnect → `room:join`.
5. **Reconnect com `recentEvents` truncado.** Snapshot tem últimos 50; UI lida com "Aguardando eventos…" antes do 50º.
6. **Sub no exato minuto Y de um evento.** Evento `minute=Y` cai no intervalo `[from, Y)` → fica com quem saiu. Documentado.
7. **Stub simulador + restart.** Estado em memória perdido. Aceito (dev/CI).
8. **`currentMinute=null` em partida live (raro).** Fallback `?? 0`. `MATCH_NOT_STARTED` bloqueia sub.
9. **Polling >10s (overrun).** Lock + `match.poll.skipped` warn. Próximo ciclo retoma.
10. **Múltiplas abas do mesmo user.** Sem conflito — todas recebem mesmos broadcasts.
11. **Anulação retro afeta sub.** Recálculo do zero usando intervals atuais — ownership preservado.

## 13. Telemetria

Logs Pino estruturados:

- `match.poll.cycle` `{ matchesPolled, durationMs }` — info
- `match.poll.skipped` `{ reason: 'lock_busy' }` — warn
- `match.poll.failed` `{ matchId, externalId, errorCode, message }` — warn
- `match.event.created` `{ roomId, matchId, athleteId, action, minute, eventId }` — info
- `match.event.canceled` `{ roomId, matchId, athleteId, action, minute, eventId }` — warn
- `match.tick` `{ matchId, currentMinute, homeScore, awayScore }` — trace
- `match.substitution_applied` `{ roomId, role, userId, removedAthleteId, addedAthleteId, minute }` — info
- `match.substitution_rejected` `{ roomId, userId, code }` — warn
- `match.finished` `{ roomId, matchId, hostScore, guestScore, winner, durationMs }` — info
- `lineup.confirmed_broadcast` `{ matchId, roomsNotified }` — info
- `stats.cartola.unmapped_scout` `{ scoutKey, occurrences }` — debug

## 14. Critérios de aceite (DoD)

### API
- [ ] Migrations aplicadas (`extend_enums` + `live_match_setup`) verdes em CI
- [ ] `scoring_rules` populada com 21 rows após migration
- [ ] `LiveMatchPoller` consumindo `HybridStatsProvider.fetchMatchLive` a cada 10s com lock
- [ ] `MatchOrchestratorService.applyLiveData` persistindo eventos novos + deletando cancelados + atualizando `lastScoutSnapshot`
- [ ] `MatchOrchestratorService.applySubstitution` com 6 validações + tx atômica
- [ ] `MatchOrchestratorService.closeRoom` cobrindo finished/postponed/canceled + winner (incl. draw)
- [ ] `ScoringService.recalculate` correto pros cenários de testes integration
- [ ] Broadcasts `match:event`, `match:event_canceled`, `match:tick`, `match:substitution_applied`, `match:finished`, `lineup:confirmed` funcionando
- [ ] `RoomSnapshotDto` inclui `live: LiveStateDto | null` populado em LIVE/FINISHED
- [ ] `CartolaStatsProvider.fetchMatchLive` mapeando scout → ActionType + drop com log
- [ ] `StubStatsProvider` simulador progredindo a partida + suportando anulação
- [ ] `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run lint` verdes
- [ ] CI verde

### Frontend
- [ ] `LiveMatchView` ativa no dispatcher quando status = `LIVE` ou `FINISHED`
- [ ] `MatchHeader` com minute interpolado avançando entre ticks
- [ ] `ScoreboardCards` com tween numérico em mudanças de score
- [ ] `TeamLineup` mostrando 5 slots + flash + pontos cumulativos
- [ ] `MatchTimeline` com eventos + "ANULADO" pra cancelados
- [ ] `SubstitutionPanel` filtrando pool por posição + mostrando pointsSoFar
- [ ] `FinishedBanner` cobrindo os 4 winners
- [ ] UX de erro pra cada `WsErrorCode` listado em §10.6
- [ ] Transição → `FinishedBanner` após `match:finished` (<2s em Playwright)
- [ ] Contracts replicados validados via Zod runtime
- [ ] `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run build` verdes
- [ ] CI verde

## 15. Estratégia de packaging

Dois PRs paralelos (padrão das verticais 2/3/4):

- **API**: `feat/live-match-api` — migrations + módulo `match` + `LiveMatchPoller` + extensão de `StatsProvider`/Cartola/Stub/Hybrid + WS handlers + `RoomsService` extension + `LineupSyncWorker` emit + testes
- **Frontend**: `feat/live-match-frontend` — `LiveMatchView` + componentes + hooks + `contracts/live.ts` + extensão de `rooms.ts`/`ws.ts` + Playwright

Frontend mergea **depois** (Playwright precisa da API rodando local — mesma sequência v4).

## 16. Fora de escopo (pós-MVP)

- Re-sync de `match_lineups` mid-match (Cartola atualizando titulares em tempo real)
- Visualizar minuto exato do gol (Cartola não publica via scout)
- UI de histórico de subs (só auditoria em DB)
- Estatísticas pré-jogo (médias, forma)
- Notificação push browser
- Multi-instance + Redis adapter (cap ~2.5k partidas concorrentes no MVP)
- Re-abrir sala que voltou de FINISHED pra LIVE (one-way no MVP)

---

## Apêndice A — Decisões fixadas no brainstorm

1. Hybrid provider para live (Cartola BR + Stub Copa) — não fatiar vertical
2. Polling 10s + stub simulador 5s=1min
3. Domínio agnóstico ao provider: enum estendido + tabela de mapeamento
4. `BACK_LINE` adicionado a `AppliesTo` pra `CLEAN_SHEET`
5. Scoring rules calibrado em paridade com Cartola; seed via migration idempotente
6. Diff de scout cumulativo cobre anulação (VAR) naturalmente
7. Recálculo do zero pós-evento e pós-sub (função pura, sem deltas)
8. Empate = `winner='draw'`; postponed/canceled = `winner='abandoned'`
9. Pool de subs replica protótipo: atletas do match fora dos 2 times
10. Push automático de lineup confirmado integrado nesta vertical
11. Interpolação client-side do minuto entre ticks
12. Dois PRs paralelos (frontend depois)
