# Vertical "Draft" — Design

**Data:** 2026-05-23
**Vertical:** 4 do roadmap (snake draft 1v1)
**Status:** spec aprovada, aguardando plano de implementação
**Spec mestre relacionada:** [`2026-05-01-draft-duel-rebuild-design.md`](./2026-05-01-draft-duel-rebuild-design.md) §2.1, §5.3, §6, §7.2
**Vertical anterior:** [`2026-05-17-room-creation-design.md`](./2026-05-17-room-creation-design.md) (no repo do frontend)

---

## 1. Resumo

Habilitar a fase de **snake draft** dentro de uma sala que já está em `DRAFTING`. Cobre as transições `DRAFTING → LIVE` (após o 10º pick) e estende `DRAFTING → FINISHED` via abandono (sem código novo — `RoomsService.abandon` já trata). Quando a sala vira `LIVE`, o frontend continua mostrando o `PendingView` atual (placeholder "Em breve"), que evolui para a UI de partida ao vivo na vertical 5.

A vertical assume que a sala já passou por `WAITING → DRAFTING` (vertical 3) e que o lobby + WS + cookie auth + room snapshot já existem. Toda a interação do draft acontece via WebSocket — sem rotas REST novas.

## 2. Decisões fixadas no brainstorm

| Tópico | Decisão | Motivo |
|---|---|---|
| Escopo | Só snake draft (sem live match, sem scoring, sem subs) | Recorte vertical mínimo; vertical 5 cobre live. |
| Snake order | Host-first clássica: `HOST,GUEST,GUEST,HOST,HOST,GUEST,GUEST,HOST,HOST,GUEST` (pickNumbers 0..9) | Determinístico, simples de validar; padrão do spec mestre §2.1. |
| Pool de atletas | `match_lineups` filtrado por `isStarter = true` | Alinhado com spec mestre — só titulares confirmados. |
| Escalação ausente | Sala vai pra `DRAFTING` normalmente; backend rejeita `draft:pick` com `LINEUP_NOT_READY` enquanto `matches.lineupsConfirmedAt = null`; frontend mostra estado "aguardando escalação" | Mais permissivo que bloquear o join; permite que os dois jogadores entrem cedo e esperem. |
| Posição | Cada pick é livre; backend valida que o role ainda não preencheu essa posição. Como cada role faz 5 picks e há 5 posições obrigatórias, "1 por posição" é matematicamente garantido. | Mais flexível (estratégia de timing das picks) e zero validação extra. |
| AFK / timer | Sem timer, sem auto-pick. Sala trava até alguém clicar Abandonar (já existe). | Spec mestre §13.2 já aceita esse risco. |
| UX pool | Duas colunas (time home / time away), chips de filtro por posição | Combina com direção visual do protótipo. |
| Turno do oponente | Pool read-only com banner "Vez de @oponente"; backend também valida | Defesa em profundidade + UX clara. |
| Pós-draft | Mantém `PendingView` "Em breve" atual | Vertical 5 evolui essa tela. |
| PRs | Dois paralelos: `feat/draft-api`, `feat/draft-frontend` | Padrão das verticals anteriores. |
| Concorrência | Validação otimista + unique constraints `(roomId, pickNumber)` e `(roomId, athleteId)` + CAS em `Room.currentPickNumber` | Mesmo padrão de `RoomsService.join`/`abandon`; sem locks pessimistas; stateless-friendly. |

## 3. Mudanças no schema (Prisma)

**Nenhum model novo.** O schema atual já cobre tudo:
- `DraftPick` com `@@unique([roomId, pickNumber])` e `@@unique([roomId, athleteId])` ✓
- `RoomLineupInterval` com `@@index([roomId, role])` ✓
- `Room.currentPickNumber Int @default(0)` ✓
- `Room.draftStartedAt`, `Room.draftFinishedAt`, `Room.matchStartedAt` ✓

**Uma migration nova** acrescenta um índice parcial:

```sql
CREATE INDEX idx_room_lineup_intervals_open
  ON room_lineup_intervals (room_id, role, athlete_id)
  WHERE valid_to_minute IS NULL;
```

Acelera a query "qual atleta está ativo nesse role agora?" — load-bearing na vertical 5 (substituições), mas faz sentido criar junto com a primeira escrita massiva nessa tabela (o draft cria 10 rows por sala). Documentado como comentário em `schema.prisma` (Prisma não modela parcial nativamente — mesmo padrão do `uniq_host_match_active`).

## 4. Módulos da API

### 4.1 `src/modules/draft/` (novo conteúdo)

```
draft/
├── draft.module.ts
├── draft.service.ts                    (regras snake + applyPick + finalizeDraft)
├── draft.service.spec.ts               (unit; Prisma mockado)
├── draft.service.integration.spec.ts   (race + atomicidade)
├── draft.constants.ts                  (TOTAL_PICKS=10, PICKS_PER_ROLE=5, SNAKE_ORDER)
├── snake-order.ts                      (função pura: pickNumber → Role)
├── snake-order.spec.ts                 (10 slots)
├── draft-mappers.ts                    (Prisma rows → DraftStateDto)
├── draft-mappers.spec.ts
├── enums/
│   ├── draft-error-code.enum.ts        (NOT_DRAFTING, NOT_YOUR_TURN, ATHLETE_NOT_IN_LINEUP,
│   │                                    POSITION_ALREADY_FILLED, ATHLETE_ALREADY_PICKED,
│   │                                    LINEUP_NOT_READY, PICK_RACE_LOST, INVALID_PICK_NUMBER)
│   └── draft-event.enum.ts             (EventEmitter topics: PICK_MADE, FINISHED)
└── dto/
    ├── draft-state.dto.ts
    ├── draft-pick.dto.ts
    ├── draft-pool-entry.dto.ts
    └── athlete-ref.dto.ts
```

Sem controller REST — toda a interação acontece via WebSocket.

### 4.2 `src/modules/match/` — extensão mínima

Acrescenta **só** `MatchOrchestratorService.openInitialIntervals(tx, roomId)`, chamado pelo `DraftService` na transição → LIVE, dentro da mesma transação Prisma. Cria as 10 rows de `RoomLineupInterval` com `validFromMinute = 0, validToMinute = null` baseadas nos `DraftPick` da sala.

Resto do `MatchOrchestrator` (eventos, scoring, subs, fechamento → FINISHED) é vertical 5.

### 4.3 `RoomsService` — extensão

`RoomsService.getSnapshot()` ganha load extra (`DraftPick` + `MatchLineup` da partida) quando `status !== WAITING`. Mapper compõe `DraftStateDto`. Sem mudança no shape externo do método. WS gateway continua delegando — automaticamente devolve snapshot enriquecido.

## 5. Contratos — DTOs e schemas Zod

### 5.1 Extensão do `RoomSnapshotDto`

```ts
type RoomSnapshot = {
  // ...campos existentes da vertical 3
  draft: DraftStateDto | null   // null em WAITING; populado em DRAFTING/LIVE/FINISHED
}

type DraftStateDto = {
  currentPickNumber: number        // 0..9 durante DRAFTING, 10 quando terminou
  currentRole: Role | null         // null quando terminou
  lineupReady: boolean             // = matches.lineupsConfirmedAt !== null
  picks: DraftPickDto[]            // ordenado por pickNumber asc
  pool: DraftPoolEntryDto[]        // titulares das duas equipes
}

type DraftPickDto = {
  pickNumber: number               // 0..9
  role: Role                       // 'host' | 'guest'
  athlete: AthleteRefDto
  madeAt: string                   // ISO
}

type DraftPoolEntryDto = {
  athlete: AthleteRefDto
  teamSide: 'home' | 'away'        // pra UI separar em colunas
  pickedByRole: Role | null        // null se ainda disponível
}

type AthleteRefDto = {
  id: string
  name: string
  shortName: string
  position: Position               // 'GOL' | 'LAT' | 'ZAG' | 'MEI' | 'ATA'
  jerseyNumber: number | null
  teamId: string                   // pra UI cruzar com homeTeam/awayTeam do match
}
```

### 5.2 WebSocket — eventos do draft

**Cliente → Server:**

| Evento | Payload (Zod) | Resposta |
|---|---|---|
| `draft:pick` | `{ roomId: uuid, pickNumber: int 0..9, athleteId: uuid }` | ack `{ ok: true }` ou `WsException` com `code: WsErrorCode` |

`pickNumber` enviado pelo cliente serve como **idempotency key** — protege contra double-click/retry e expõe dessincronia (cliente com snapshot stale).

**Server → broadcast `room:<id>`:**

| Evento | Payload |
|---|---|
| `draft:pick_made` | `{ pick: DraftPickDto, nextPickNumber: int \| null, currentRole: Role \| null }` |
| `draft:current_pick` | `{ pickNumber: int, role: Role }` |
| `match:started` | `{ startedAt: string, hostLineup: AthleteRefDto[], guestLineup: AthleteRefDto[] }` |

Após o 10º pick, ordem dos broadcasts: `draft:pick_made` (com `nextPickNumber: null`) → `match:started`.

### 5.3 Snake order

Função pura `snakeRoleForPick(pickNumber: 0..9): Role` em `draft/snake-order.ts`. Tabela determinística (host-first):

```ts
const SNAKE_ORDER: Role[] = [
  Role.HOST,  // 0
  Role.GUEST, // 1
  Role.GUEST, // 2
  Role.HOST,  // 3
  Role.HOST,  // 4
  Role.GUEST, // 5
  Role.GUEST, // 6
  Role.HOST,  // 7
  Role.HOST,  // 8
  Role.GUEST, // 9
]
```

Spec unit cobre os 10 valores + range check. Mudar pra "guest-first" ou "sorteio" no futuro = trocar essa constante (+ talvez campo novo `Room.snakeStartRole`).

## 6. Lógica do `draft:pick` — validações e transação

### 6.1 Pré-validações (fora de transação)

Implementado em `DraftService.applyPick(input, user)`. Toda a regra fica no service.

1. **Sala existe + user é membro** — reusa `RoomsService.assertMembership(roomId, userId)`. Erro: `ROOM_NOT_FOUND` ou `NOT_MEMBER`.
2. **Sala em DRAFTING** — carrega `room` com `select { id, matchId, status, currentPickNumber, hostUserId, guestUserId }`. Se `status !== DRAFTING`: `NOT_DRAFTING`.
3. **`pickNumber === room.currentPickNumber`** — proteção idempotency. Se diferente: `INVALID_PICK_NUMBER`.
4. **É a vez deste user** — `expectedRole = snakeRoleForPick(currentPickNumber)`; deriva role (`HOST` se `hostUserId===userId`, senão `GUEST`); se diferente: `NOT_YOUR_TURN`.
5. **Lineup confirmado** — `match.lineupsConfirmedAt !== null`. Se null: `LINEUP_NOT_READY`.
6. **Atleta está no `match_lineups` como titular** — `findFirst({ matchId, athleteId, isStarter: true })` join com `Athlete` pra pegar position. Se ausente: `ATHLETE_NOT_IN_LINEUP`.
7. **Atleta ainda não picado nesta sala** — `findFirst` em `DraftPick { roomId, athleteId }`. Se existe: `ATHLETE_ALREADY_PICKED`.
8. **Role ainda não preencheu essa posição** — count `DraftPick` join `Athlete` por `roomId + role + position`. Se >= 1: `POSITION_ALREADY_FILLED`.

> ~5 queries leves antes de abrir transação. Aceitável: pick não é hot path.

### 6.2 Transação atômica

```ts
const result = await prisma.$transaction(async (tx) => {
  // a. INSERT do pick — uniques (roomId, pickNumber) e (roomId, athleteId) protegem race
  const pick = await tx.draftPick.create({
    data: { roomId, pickNumber: currentPickNumber, role: expectedRole, athleteId },
  })

  // b. CAS: bump current_pick_number só se ainda for o valor que validamos
  const cas = await tx.room.updateMany({
    where: { id: roomId, currentPickNumber },
    data: { currentPickNumber: currentPickNumber + 1 },
  })
  if (cas.count === 0) throw new DraftRaceLost()

  // c. Se foi o 10º pick (pickNumber === 9 antes do bump), transição → LIVE
  if (currentPickNumber === 9) {
    await finalizeDraft(tx, roomId)
    return { phase: 'live' as const, pick }
  }

  return { phase: 'drafting' as const, pick }
})
```

Mapeamento P2002 (unique violation) → erro WS:
- target inclui `room_id_pick_number` → `PICK_RACE_LOST`
- target inclui `room_id_athlete_id` → `ATHLETE_ALREADY_PICKED` (validação stale; cliente re-sincroniza)
- outro → re-throw

### 6.3 `finalizeDraft(tx, roomId)`

Dentro da mesma transação do 10º pick:

```ts
async finalizeDraft(tx, roomId) {
  // a. Carrega os 10 picks pra criar os intervalos
  const picks = await tx.draftPick.findMany({
    where: { roomId },
    select: { role: true, athleteId: true },
  })
  if (picks.length !== 10) throw new Error('finalizeDraft invariant: expected 10 picks')

  // b. Cria 10 RoomLineupInterval (from=0, to=null)
  await tx.roomLineupInterval.createMany({
    data: picks.map((p) => ({
      roomId,
      role: p.role,
      athleteId: p.athleteId,
      validFromMinute: 0,
      validToMinute: null,
    })),
  })

  // c. CAS de status DRAFTING → LIVE (proteção dupla)
  const now = new Date()
  const updated = await tx.room.updateMany({
    where: { id: roomId, status: RoomStatus.DRAFTING },
    data: {
      status: RoomStatus.LIVE,
      draftFinishedAt: now,
      matchStartedAt: now,
    },
  })
  if (updated.count === 0) throw new Error('finalizeDraft invariant: room not in DRAFTING')
}
```

> `matchStartedAt = now` é o timestamp **da sala virar live**, não do kickoff da partida real. Spec mestre §2.1 fixou que pontos contam desde `valid_from_minute=0` (kickoff real), independente de quando o draft terminou. Esse campo é audit/UI, não scoring.

### 6.4 Emissão de eventos (pós-commit)

Depois do `$transaction` retornar:

```ts
eventEmitter.emit(DraftEvent.PICK_MADE, {
  roomId,
  pick,
  nextPickNumber: result.phase === 'live' ? null : currentPickNumber + 1,
  nextRole: result.phase === 'live' ? null : snakeRoleForPick(currentPickNumber + 1),
})
if (result.phase === 'live') {
  eventEmitter.emit(MatchEvent.STARTED, { roomId, startedAt: now })
}
```

`WsGateway` ouve via `@OnEvent`:
- `DraftEvent.PICK_MADE` → broadcast `draft:pick_made` + (se `nextPickNumber !== null`) `draft:current_pick`
- `MatchEvent.STARTED` → carrega lineups completos pra payload → broadcast `match:started`

**Pós-commit, não dentro da tx.** Se broadcast rodasse antes do commit e o commit falhasse, clientes ficariam com estado falso.

### 6.5 Reconnect / dessincronia

Cliente que reconecta no meio do draft emite `room:join { roomId }` → gateway responde com `RoomSnapshot` enriquecido (com `draft: DraftStateDto`). Cliente substitui o cache TanStack via `setQueryData`. Snapshot é fonte de verdade — qualquer divergência com eventos anteriores resolve em favor do snapshot.

## 7. Tabela canônica de erros (WS)

Erros do draft estendem o enum `WsErrorCode` existente (mesmo arquivo, sem enum separado — mantém consistência com lobby).

| Cenário | `code` | Disconnect? |
|---|---|---|
| Payload inválido (Zod safeParse falhou) | `VALIDATION` | não |
| Sala não existe | `ROOM_NOT_FOUND` | não |
| User não é membro | `NOT_MEMBER` | sim |
| Sala não está em DRAFTING | `NOT_DRAFTING` | não |
| `pickNumber` desincronizado | `INVALID_PICK_NUMBER` | não — cliente re-sync |
| Não é a vez do user | `NOT_YOUR_TURN` | não |
| Escalação não confirmada | `LINEUP_NOT_READY` | não |
| Atleta não está no lineup | `ATHLETE_NOT_IN_LINEUP` | não |
| Atleta já picado | `ATHLETE_ALREADY_PICKED` | não — cliente re-sync |
| Posição já preenchida | `POSITION_ALREADY_FILLED` | não |
| Race perdida no slot | `PICK_RACE_LOST` | não — cliente re-sync |
| Erro interno inesperado | `INTERNAL` | não |

## 8. Frontend

### 8.1 Rotas

**Sem rota nova.** A rota `/rooms/[id]` existe e tem dispatcher por status. Só estendemos:

```
src/app/(app)/rooms/[id]/
├── page.tsx              ← estende dispatcher: DRAFTING → <DraftView>
├── lobby-view.tsx        (existente, sem mudança)
├── draft-view.tsx        ← NOVO
├── draft-view.test.tsx   ← NOVO
└── pending-view.tsx      (existente, sem mudança)
```

Dispatcher final:

```tsx
if (room.data.status === RoomStatus.WAITING)  return <LobbyView room={room.data} isHost={isHost} />
if (room.data.status === RoomStatus.DRAFTING) return <DraftView room={room.data} isHost={isHost} />
return <PendingView room={room.data} />
```

### 8.2 Componentes (`src/components/draft/`)

| Componente | Responsabilidade |
|---|---|
| `DraftBoard` | 10 slots dos picks: 5 do host à esquerda, 5 do guest à direita, ordenados por pickNumber. Destaca slot `currentPickNumber`. `JerseyIcon` + nome quando preenchido, placeholder quando vazio. |
| `DraftPool` | Duas colunas (home/away). Chips de filtro por posição. Renderiza `PlayerCard`. Prop `disabled: boolean` (vez do oponente ou lineup não pronto). Quando `lineupReady = false`, mostra estado vazio + botão "Atualizar escalação" que re-emite `room:join` (refetch do snapshot). |
| `PlayerCard` | `JerseyIcon` (cor do time + número) + nome + abbrev da posição. Estados: `available` (clicável), `picked` (riscado + label "@host"/"@guest"), `disabled` (greyed). Click abre `ConfirmPickDialog`. |
| `TurnBanner` | Banner topo: "Sua vez — pick N/5" / "Vez de @oponente" / "Aguardando escalação". Contador "N restantes pra você". |
| `ConfirmPickDialog` | Modal shadcn confirmando "Draftar @nome (POS, time)?". Cancelar / Confirmar. Confirm dispara `useMakePick.mutate`. Botão usa `InlineSpinner` existente. |

Se `JerseyIcon` não existir ainda no projeto, a primeira task da implementação cria ele em `src/components/ui/JerseyIcon.tsx` — SVG inline de camisa com `color`, `secondaryColor`, `number`. Mesma camisa pra todos atletas do mesmo time (spec mestre §2.5: sem foto de atleta).

### 8.3 Hooks (`src/hooks/`)

| Hook | Função |
|---|---|
| `useMakePick(roomId)` | `useMutation` que emite `draft:pick { roomId, pickNumber, athleteId }` via socket e aguarda ack. Em erro, expõe `error.code` (WsErrorCode) pra UI. Não invalida queries — broadcast `draft:pick_made` atualiza via WS sync. |
| `useDraftSocket(roomId)` | Sub-hook chamado dentro de `DraftView`. Estende `useRoomSocket` (vertical 3). Listeners de `draft:pick_made` / `draft:current_pick` / `match:started`, cada um aplicando `setQueryData` no cache de `useRoom(roomId)`. Usa o singleton de socket — não abre conexão nova. |

`useRoom` continua o mesmo — a query agora devolve `RoomSnapshot` com `draft: DraftStateDto`. Componentes consomem `room.data.draft` direto.

### 8.4 Estrutura do `DraftView`

```tsx
function DraftView({ room, isHost }) {
  useDraftSocket(room.id)
  const draft = room.draft!  // garantido por dispatcher
  const myRole = isHost ? 'host' : 'guest'
  const isMyTurn = draft.currentRole === myRole
  const canPick = isMyTurn && draft.lineupReady
  const positionsRemaining = computePositionsRemaining(draft.picks, myRole)
  const makePick = useMakePick(room.id)

  return (
    <div className="space-y-4">
      <TurnBanner
        currentRole={draft.currentRole}
        myRole={myRole}
        lineupReady={draft.lineupReady}
        currentPickNumber={draft.currentPickNumber}
      />
      <DraftBoard picks={draft.picks} currentPickNumber={draft.currentPickNumber} />
      <DraftPool
        pool={draft.pool}
        match={room.match}
        disabled={!canPick}
        positionsRemaining={positionsRemaining}
        onPick={(athleteId) => makePick.mutate({ pickNumber: draft.currentPickNumber, athleteId })}
      />
      <RoomActions roomId={room.id} showAbandon={true} />
    </div>
  )
}
```

`computePositionsRemaining(picks, myRole)`: pura — `POSITIONS.filter(p => !picks.some(pk => pk.role === myRole && pk.athlete.position === p))`. Cinza posições já preenchidas pelo role atual (UX preventiva; backend ainda valida).

### 8.5 Sincronização snapshot ↔ eventos WS

Padrão idêntico ao lobby (vertical 3): WS dispara, listener faz `setQueryData(['room', id], (old) => patched)`.

| Evento | Patch |
|---|---|
| `draft:pick_made` | append `pick` em `draft.picks`; atualiza `pool[athleteId].pickedByRole`; bump `draft.currentPickNumber`; atualiza `draft.currentRole` |
| `draft:current_pick` | redundante mas idempotente — atualiza `currentPickNumber` e `currentRole` |
| `match:started` | troca `room.status` para `'live'`; popula `room.matchStartedAt`. Dispatcher re-renderiza pra `PendingView`. |
| `room:abandoned` | já tratado pela vertical 3 |

### 8.6 Erros — mapeamento pra UX

| WsErrorCode | UX |
|---|---|
| `LINEUP_NOT_READY` | Pool disabled + banner "Aguardando escalação". Botão "Atualizar" re-emite `room:join`. |
| `NOT_YOUR_TURN` | Quase impossível atingir (cliente já desabilita). Toast "Vez do oponente" + re-sync. |
| `INVALID_PICK_NUMBER` / `PICK_RACE_LOST` / `ATHLETE_ALREADY_PICKED` | Toast "Pick rejeitado — sincronizando…" + re-emit `room:join`. |
| `POSITION_ALREADY_FILLED` | Toast "Você já tem um atleta dessa posição" (raro — cliente já cinza). |
| `ATHLETE_NOT_IN_LINEUP` | Toast "Atleta não está mais escalado" + re-sync. |
| `NOT_DRAFTING` | Re-sync (snapshot stale). |
| `NOT_MEMBER` / `ROOM_NOT_FOUND` | Redireciona pra `/me`. |
| `VALIDATION` / `INTERNAL` | Toast genérico "Erro — tente novamente". |

Todos via `useToast` shadcn que já existe (padrão da vertical 3).

### 8.7 Contracts replicados (`src/lib/contracts/`)

- `draft.ts` (novo) — espelho dos schemas Zod da API: `draftStateSchema`, `draftPickSchema`, `draftPoolEntrySchema`, `athleteRefSchema`, payloads WS (`DraftPickMadePayload`, `DraftCurrentPickPayload`, `MatchStartedPayload`). Validação runtime nos handlers de socket.
- `rooms.ts` — estende `roomSnapshotSchema` com `draft: draftStateSchema.nullable()`.
- `ws.ts` — adiciona valores novos a `WsErrorCode` (mesmo enum) referentes ao draft.

## 9. Estratégia de testes

### 9.1 API — Unit

| Arquivo | Cobertura |
|---|---|
| `snake-order.spec.ts` | Cada pickNumber 0..9 mapeia pro role esperado. Out-of-range lança. |
| `draft.service.spec.ts` | Para cada erro em §7: monta state fake com Prisma mockado, chama `applyPick`, verifica `WsException` com `code` correto. Happy path: pick não-final emite `DRAFT_PICK_MADE` com `nextPickNumber`/`nextRole` corretos. Pick #9 emite `DRAFT_PICK_MADE` com nulls + `MATCH_STARTED`. |
| `draft-mappers.spec.ts` | Compõe `DraftStateDto` a partir de picks + lineups + pool; flags `pickedByRole`, `teamSide`, `lineupReady`. Edge case `lineupsConfirmedAt = null` → `lineupReady: false`. |
| `room-mappers.spec.ts` (estende existente) | Sala `WAITING` → `draft: null`. Sala `DRAFTING`/`LIVE`/`FINISHED` → `draft` populado. |
| `ws.gateway.spec.ts` (estende existente) | Handler `draft:pick` valida payload Zod e delega ao service. `@OnEvent(DraftEvent.PICK_MADE)` broadcasta com payload correto. |

### 9.2 API — Integration (Postgres real via Testcontainers)

| Arquivo | Cenários |
|---|---|
| `draft.service.integration.spec.ts` | **Race do slot:** `applyPick(pickNumber=0)` × 2 em paralelo (host vs guest no mesmo pickNumber, fora-de-turno do guest cobre via `NOT_YOUR_TURN`; o caso de slot race verdadeiro é host abrindo duas abas e clicando simultâneo no mesmo pickNumber) → um cai em `PICK_RACE_LOST`, outro persiste. DB tem 1 row. **Race do atleta:** picks paralelos em pickNumbers consecutivos do mesmo athleteId (host pick 0 + guest pick 1, ambos validaram antes do insert) → unique `(roomId, athleteId)` vence; perdedor recebe `ATHLETE_ALREADY_PICKED`. **Tx atômica:** força erro em `roomLineupInterval.createMany` no 10º pick → `DraftPick` do round também é rolled back. **Happy 10-pick run:** completa um draft inteiro, verifica `RoomLineupInterval` tem 10 rows com `validFromMinute=0, validToMinute=null` e `Room.status = LIVE`. |

### 9.3 API — E2E

`test/e2e/draft.e2e-spec.ts`:

- Setup: match com `lineupsConfirmedAt` set, 11+ titulares por time cobrindo todas as posições. Cria sala + join → DRAFTING.
- 2 socket clients (host + guest). 10 picks na ordem snake. Após cada pick verifica broadcast nos dois clientes + DB.
- 10º pick: `match:started` chega; `Room.status = LIVE`; `RoomLineupInterval` tem 10 rows.
- Negativos:
  - `pickNumber` errado → `INVALID_PICK_NUMBER`
  - Fora do turno → `NOT_YOUR_TURN`
  - Atleta repetido após snapshot stale → `ATHLETE_ALREADY_PICKED`
  - Pick com `lineupsConfirmedAt = null` → `LINEUP_NOT_READY`
  - Abandono durante draft → `winner` correto + broadcast `room:abandoned`

### 9.4 Frontend — Vitest

| Arquivo | Cobertura |
|---|---|
| `useMakePick.test.tsx` | Mock socket: emite `draft:pick` com payload correto; resolve em ack; rejeita em error expondo `code`. |
| `useDraftSocket.test.tsx` | Mock socket: listeners aplicam patches via `setQueryData`; cleanup remove listeners. |
| `draft-view.test.tsx` | `lineupReady=false` → "Aguardando escalação", pool disabled. `currentRole=myRole` → pool habilitado, TurnBanner "Sua vez". `currentRole=oposto` → pool disabled. |
| `DraftBoard.test.tsx` | 10 slots; preenchidos mostram JerseyIcon+nome; slot atual destacado. |
| `DraftPool.test.tsx` | Filtro de posição via chips; `pickedByRole` mostra label; click em disponível abre dialog. |
| `PlayerCard.test.tsx` | 3 estados visuais; click chama `onPick` só em available. |
| `computePositionsRemaining.test.ts` | Picks vazios → todas posições; 3 picks de 3 posições → as outras 2. |

### 9.5 Frontend — Playwright

`test/e2e/draft.spec.ts`:

- 2 browser contexts (host + guest). Mock API responses do match com `lineupsConfirmedAt` set + 11 titulares por time.
- Cria sala → guest entra → status DRAFTING.
- Host clica em atleta no pool → dialog → confirma → broadcast chega nos dois contexts < 2s.
- Continua pelos 10 picks alternando contexts. Verifica `TurnBanner` muda em tempo real.
- 10º pick: ambos contexts veem transição → `PendingView` visível < 2s.
- Variante: host abandona mid-draft → guest vê "Sala abandonada — você venceu" (cobertura já existente da vertical 3).

### 9.6 Cobertura mínima por item

| Item | Unit | Integration | E2E |
|---|---|---|---|
| `snake-order` | ✓ | — | implícito |
| `draft.service.applyPick` happy | ✓ | ✓ | ✓ |
| Cada erro da §7 | ✓ | parcial (race) | ATHLETE_ALREADY_PICKED + outros |
| Transição DRAFTING→LIVE atômica | ✓ | ✓ | ✓ |
| `RoomLineupInterval` criados com from=0 | ✓ | ✓ | ✓ |
| Broadcast `draft:pick_made` | ✓ gateway | — | ✓ |
| Broadcast `match:started` | ✓ gateway | — | ✓ |
| Snapshot enriquecido com `draft` | ✓ mappers | ✓ | implícito (UI ler) |
| Frontend pool disabled em `LINEUP_NOT_READY` | ✓ | — | ✓ |
| Frontend pool disabled em vez do oponente | ✓ | — | ✓ |
| Frontend transição → `PendingView` pós-draft | ✓ | — | ✓ |

## 10. Edge cases

1. **Lineup chega no meio do draft.** Worker `LineupSyncWorker` confirma escalação após sala já em DRAFTING. Cliente não recebe push automático nesta vertical — `DraftPool` tem botão "Atualizar escalação" (re-emite `room:join`) quando `lineupReady = false`. Push automático fica pra vertical 5 (junto com worker emitindo WS).
2. **Atleta sai do lineup entre snapshot e pick.** Vendor real pode publicar nova versão de lineup ("atleta lesionado"). Backend pega via `ATHLETE_NOT_IN_LINEUP`. Cliente recebe toast + re-sync.
3. **Posição ficou impossível** (ex: escalação reformulada deixa time sem zagueiros). Chip da posição mostra "Indisponível", mas não é blocker — caso real depende do que o vendor faz; vertical 5 lida com escalação revista. Aceito como risco documentado.
4. **Pick simultâneo na virada → LIVE.** Dois `draft:pick` paralelos quando `currentPickNumber=9`. CAS + uniques resolvem: um vence, outro `PICK_RACE_LOST` ou `INVALID_PICK_NUMBER`.
5. **Reconnect mid-pick.** Cliente fechou aba após mutate mas antes do ack. Ao voltar, `room:join` traz snapshot atualizado: ou pick está persistido (vê na board) ou não (slot ainda aberto). Sem estado dúbio.
6. **Match vira POSTPONED durante draft.** Draft continua — pool é estável (vem do `match_lineups` snapshotado). Próxima vertical decide o que fazer quando partida não acontece. Aceito como risco.
7. **Duas abas do mesmo user.** Ambas conectadas no socket room; ambas recebem broadcasts. Mutation feita em uma, outra reage via WS sync. OK.
8. **Cookie expira mid-draft.** `connect_error UNAUTHORIZED` → cliente faz `POST /auth/refresh` (já existe) → socket reconnect → re-emit `room:join` → snapshot fresco. Estado preservado.

## 11. Telemetria

Logs estruturados via Pino (sem dashboards novos):

- `draft.pick_made` `{ roomId, pickNumber, role, athleteId, userId }`
- `draft.pick_rejected` `{ roomId, pickNumber, userId, code }`
- `draft.race_lost` `{ roomId, pickNumber, role, userId }` — sub-categoria de rejected, separada pra alarmar se ficar frequente
- `match.started` `{ roomId, matchId, draftDurationMs }` — duração do draft (útil pra futuro de timer)

## 12. Critérios de aceite (DoD)

### API
- [ ] Migration aplicada (partial index `idx_room_lineup_intervals_open`) rodando em CI
- [ ] WS handler `draft:pick` com toda validação da §6.1
- [ ] Transação atômica + `finalizeDraft` cria 10 `RoomLineupInterval` + vira LIVE
- [ ] Broadcasts `draft:pick_made`, `draft:current_pick`, `match:started` funcionando
- [ ] `RoomSnapshotDto` inclui `draft: DraftStateDto | null` populado corretamente
- [ ] Unit + integration + e2e verdes
- [ ] `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run lint` verdes
- [ ] CI verde

### Frontend
- [ ] `DraftView` ativa no dispatcher quando status = `DRAFTING`
- [ ] `DraftBoard` mostra 10 slots, atualiza em tempo real após cada pick (assert < 2s em Playwright)
- [ ] `DraftPool` filtra por posição, disabled quando não-vez ou lineup-not-ready, mostra atletas já picados
- [ ] `ConfirmPickDialog` confirma antes de emitir
- [ ] UX de erro coberta pra cada `WsErrorCode` listado em §8.6
- [ ] Transição → `PendingView` após 10º pick (assert < 2s em Playwright)
- [ ] Contracts replicados validados via Zod runtime
- [ ] `npm test`, `npm run test:e2e`, `npm run lint` verdes
- [ ] CI verde

## 13. Fora de escopo (próximas verticals)

- **Vertical 5 — Live match**: `MatchOrchestrator` completo (poll de eventos, scoring, broadcast `match:event` / `match:score_updated`), substituições (`match:substitute`, `room_lineup_intervals` close/open), transição `LIVE → FINISHED`, UI `MatchScoreboard` + `MatchTimeline` + `SubstitutionDialog`.
- Push automático de "lineup confirmado" (worker emitindo WS) — entra junto com vertical 5.
- Timer de pick (deferido até virar dor real).
- Estatísticas no draft ("atleta X tem média Y") — vertical pós-MVP.

## 14. Estratégia de packaging

Dois PRs paralelos (padrão das verticals 2 e 3):

- **API**: `feat/draft-api` — migration + DraftModule (service + snake-order + mappers) + `MatchOrchestratorService.openInitialIntervals` + extensão do WsGateway + extensão do RoomsService.getSnapshot + testes
- **Frontend**: `feat/draft-frontend` — DraftView + componentes (DraftBoard, DraftPool, PlayerCard, TurnBanner, ConfirmPickDialog) + `JerseyIcon` (se ainda não existir) + useMakePick + useDraftSocket + contracts/draft.ts + extensão de rooms.ts + Playwright

Frontend mergea depois (Playwright precisa da API rodando local).
