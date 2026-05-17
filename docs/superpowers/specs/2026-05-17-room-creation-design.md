# Vertical "Criação de Sala" — Design

**Data:** 2026-05-17
**Vertical:** 3 do roadmap (item "Criação de sala" do README do frontend)
**Status:** spec aprovada, aguardando plano de implementação
**Spec mestre relacionada:** [`2026-05-01-draft-duel-rebuild-design.md`](./2026-05-01-draft-duel-rebuild-design.md) §5.3, §6, §7

---

## 1. Resumo

Habilitar o fluxo completo de **criar sala**, **convidar via link**, **entrar como guest** e **lobby em tempo real**, mais a listagem "Minhas salas" em `/me`. Esta vertical NÃO inclui o draft (snake pick) — só leva a sala até o estado `DRAFTING`/`LIVE` mostrando um placeholder "Em breve".

O recorte cobre as transições `null → WAITING → DRAFTING` (entrada do guest) e `WAITING → FINISHED` (abandono pelo host antes do guest entrar) da máquina de estados. A vertical seguinte (Draft) consome a infra de WebSocket subida aqui e adiciona handlers de pick.

## 2. Decisões fixadas no brainstorm

| Tópico | Decisão | Motivo |
|---|---|---|
| Escopo | Lobby completo (create, link, join com preview, lobby waiting realtime, abandon, /me/rooms). Sem draft. | Recorte vertical entrega valor isolado (testar UX de criação) sem inflar pra reescrever draft+live junto. |
| Tempo real | Socket.IO já nesta vertical — gateway + cookie auth + namespace de sala | Draft (próxima vertical) precisa de WS de qualquer jeito; subir agora evita refactor depois. |
| Convite | Link compartilhável `/rooms/join/[code]` com preview + botão confirmar | UX simples (copiar/colar URL). Sem formulário "digite o código". |
| Charset do code | 32 chars: `A-Z` sem `O/I/L` + `2-9` (1B combinações) | Sem chars ambíguos pra leitura por voz/screenshot. Schema já tem CHAR(6). |
| TTL da sala | `expires_at = kickoff_at + 120min` | Sala faz sentido durante a janela do match. RoomExpirationWorker (existente, 1min) fecha automático. |
| Multiplicidade | 1 sala ativa por (host, match) — recriar devolve a existente | Resolve "perdi meu link", evita duplicatas, simplifica /me/rooms. |
| Pacote contracts | Replicar Zod schemas no frontend por copy-paste (mesmo padrão do catalog) | `@draft-duel/contracts` formal fica como vertical técnica futura. |
| Convenção de enum | `as const` objects + types derivados, em arquivos separados, com constantes nomeadas pra valores semânticos | Feedback do user — evita strings mágicas duplicadas, refactor seguro. |

## 3. Mudanças no schema (Prisma)

**Nenhum model novo.** O schema atual (`prisma/schema.prisma`) já cobre tudo:
- `Room.code String @unique @db.Char(6)` ✓
- `Room.expiresAt DateTime` ✓
- `Room.status RoomStatus` com enum `WAITING|DRAFTING|LIVE|FINISHED` ✓
- `Room.winner RoomWinner?` com enum `HOST|GUEST|DRAW|ABANDONED` ✓

**Uma migration nova** adiciona um partial unique index não-nativo do Prisma via `prisma migrate dev` editando o `.sql` gerado:

```sql
CREATE UNIQUE INDEX uniq_host_match_active
  ON rooms (host_user_id, match_id)
  WHERE status IN ('WAITING', 'DRAFTING', 'LIVE');
```

Garante a constraint "1 sala ativa por (host, match)" no nível do banco. Documentar a constraint em comentário no `schema.prisma` (Prisma não modela parcial nativamente).

## 4. API REST — endpoints

Todos sob auth (cookie `dd_access`) exceto onde indicado. Rate-limit aplicado via decorator existente em `src/common/rate-limit/`.

| Método | Rota | Auth | Body / Params | Resposta principal |
|---|---|---|---|---|
| `POST` | `/rooms` | sim | `{ matchId: string }` | **201** `RoomSnapshot` (sala nova) / **200** `RoomSnapshot` (devolveu existente do user pra esse match) |
| `POST` | `/rooms/:code/join` | sim | — | **200** `RoomSnapshot` |
| `GET` | `/rooms/:id` | sim | — | **200** `RoomSnapshot` (host ou guest only) |
| `GET` | `/rooms/by-code/:code/preview` | **não** | — | **200** `RoomPreview` (versão pública pra tela de convite) |
| `POST` | `/rooms/:id/abandon` | sim | — | **200** `RoomSnapshot` (atualizado) |
| `GET` | `/me/rooms` | sim | `?status=active\|finished` (default ambos) | `{ active: RoomSummary[], finished: RoomSummary[] }` |

### 4.1 DTOs

`RoomSnapshot`:
```ts
{
  id: string
  code: string
  status: RoomStatus
  match: { id: string, kickoffAt: string, status: MatchStatus,
           homeTeam: TeamRef, awayTeam: TeamRef }
  host: { id: string, nickname: string }
  guest: { id: string, nickname: string } | null
  expiresAt: string  // ISO
  createdAt: string
}
```

`RoomPreview` (sem dados sensíveis, pra link público):
```ts
{
  code: string
  status: RoomStatus
  match: { kickoffAt: string, homeTeam: TeamRef, awayTeam: TeamRef }
  host: { nickname: string }
  expiresAt: string
}
```

`RoomSummary` (listagem em /me):
```ts
{
  id: string
  status: RoomStatus
  role: 'HOST' | 'GUEST'
  match: { kickoffAt: string, homeTeam: TeamRef, awayTeam: TeamRef }
  opponent: { nickname: string } | null
  winner: RoomWinner | null
  createdAt: string
}
```

### 4.2 Validações críticas

**`POST /rooms`:**
1. `matchId` existe (`404 MATCH_NOT_FOUND`)
2. `match.status ∈ {SCHEDULED, LIVE}` e `match.kickoffAt > now - 90min` (`409 MATCH_INELIGIBLE`)
3. Existe sala ativa `(host=user, match=matchId, status ∈ {WAITING,DRAFTING,LIVE})` → retorna ela (200)
4. Senão cria: gera `code`, `expiresAt = kickoffAt + 120min`, `status = WAITING`

**`POST /rooms/:code/join`:**
1. Sala existe (`404 ROOM_NOT_FOUND`)
2. Sala status = `WAITING` (`409 ROOM_NOT_OPEN`)
3. `expires_at > now` (`410 ROOM_EXPIRED`)
4. `user.id !== host.id` (`409 IS_HOST`)
5. Match elegível — mesma regra da criação: `match.status ∈ {SCHEDULED, LIVE}` e `match.kickoffAt > now - 90min` (`409 MATCH_INELIGIBLE`)
6. **UPDATE atômico**: `UPDATE rooms SET guest_user_id=$id, status='DRAFTING', draft_started_at=now() WHERE id=$id AND status='WAITING' AND guest_user_id IS NULL`. Se affected rows = 0 → `409 RACE_LOST`.

**`POST /rooms/:id/abandon`:**
1. User é host ou guest (`403 NOT_MEMBER`)
2. Em `WAITING`: `status → FINISHED`, `winner = null`
3. Em `DRAFTING|LIVE`: `status → FINISHED`, `winner = adversário` (lógica completa só ganha sentido nas próximas verticals, mas o endpoint já trata)
4. Emite `room:abandoned` via WS

### 4.3 Rate-limits

| Endpoint | Limite |
|---|---|
| `POST /rooms` | 10 / hora / user |
| `POST /rooms/:code/join` | 30 / hora / user |
| `POST /rooms/:id/abandon` | 30 / hora / user |
| `GET *` | default global |

Configurado como constantes nomeadas em `rooms.constants.ts`.

### 4.4 Geração de código

Função pura em `src/modules/rooms/code-generator.ts`:
- `CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'` (32 chars)
- `CODE_LENGTH = 6`
- Loop com retry on `Prisma P2002` (unique violation), `CODE_GEN_MAX_RETRIES = 5` (na prática 1B combinações torna colisão estatisticamente irrelevante)

## 5. WebSocket — `WsModule`

### 5.1 Estrutura

```
src/modules/ws/
├── ws.module.ts                  (imports AuthModule, RoomsModule, EventEmitterModule)
├── ws.gateway.ts                 (@WebSocketGateway, namespace '/')
├── ws-auth.middleware.ts         (cookie dd_access → JWT verify → socket.data.user)
├── ws-error.filter.ts            (catch → emit 'error' { code, message })
├── handlers/
│   └── lobby.handler.ts          (room:join, room:leave — pode ser inline no gateway se ficar curto)
├── enums/
│   ├── ws-client-event.enum.ts   (ROOM_JOIN, ROOM_LEAVE, DRAFT_PICK*, MATCH_SUBSTITUTE*)
│   ├── ws-server-event.enum.ts   (ROOM_STATE, ROOM_GUEST_JOINED, ROOM_ABANDONED, DRAFT_*, MATCH_*)
│   └── ws-error-code.enum.ts     (UNAUTHORIZED, NOT_MEMBER, ROOM_NOT_FOUND, VALIDATION, INTERNAL)
└── ws.constants.ts               (ROOM_CHANNEL_PREFIX='room:', SOCKET_AUTH_COOKIE='dd_access')
```

*Eventos `DRAFT_*` e `MATCH_*` ficam **listados nos enums já agora** (espelhando spec §7.2) mas só os de lobby têm handler. Próximas verticals adicionam implementação sem mexer nos enums.

### 5.2 Handshake auth

Hook global `io.use((socket, next) => ...)`:
1. Lê cookie `dd_access` do header de upgrade
2. Reusa `AuthService.verifyAccessToken()` (já existe e testado)
3. Atribui `socket.data.user = { id, email }` ou rejeita com `WsException('UNAUTHORIZED')` → `connect_error`

### 5.3 Eventos desta vertical

| Evento | Direção | Payload | Trigger |
|---|---|---|---|
| `room:join` | client → server | `{ roomId }` | usuário entra no canal WS. Valida membership (`RoomsService.assertMembership`). Faz `socket.join('room:'+roomId)`. Responde com `room:state`. |
| `room:leave` | client → server | `{ roomId }` | `socket.leave('room:'+roomId)`. Não abandona a sala lógica. |
| `room:state` | server → client | `RoomSnapshot` | resposta a `room:join` ou reconnect. |
| `room:guest_joined` | server → broadcast `room:<id>` | `{ guest, status }` | RoomsService.join() emite via EventEmitter; gateway recebe @OnEvent e broadcasta. |
| `room:abandoned` | server → broadcast | `{ by: Role, winner: RoomWinner \| null }` | RoomsService.abandon() emite via EventEmitter. |
| `error` | server → client | `{ code: WsErrorCode, message: string }` | ws-error.filter genérico. |

### 5.4 Acoplamento entre RoomsService e WsGateway

**Direções de dependência:**
- `WsModule` → `RoomsModule`: gateway chama `RoomsService.assertMembership()` e `RoomsService.getSnapshot()` quando trata `room:join` (forward, sem ciclo).
- `RoomsModule` → `WsModule`: **não existe**. RoomsService NÃO importa o gateway — usa `@nestjs/event-emitter` (dep oficial Nest) pra publicar eventos internos.

Fluxo de broadcast (ex.: guest entrou):
- `RoomsService.join()` faz `eventEmitter.emit(RoomEvent.GUEST_JOINED, { roomId, snapshot })`
- `WsGateway` declara `@OnEvent(RoomEvent.GUEST_JOINED)` e faz `server.to('room:'+roomId).emit('room:guest_joined', { guest, status })`

Tabela de mapeamento eventos internos → eventos WS:

| `RoomEvent` interno (EventEmitter) | Evento WS broadcast |
|---|---|
| `ROOM_GUEST_JOINED` | `room:guest_joined` |
| `ROOM_ABANDONED` | `room:abandoned` |

`RoomEvent` enum em `src/modules/rooms/enums/room-event.enum.ts`. Sem ciclo de dependência; trivial adicionar outros listeners (analytics etc.) depois sem mexer no RoomsService.

### 5.5 Reconexão e cookie expirado

- Cliente recebe `disconnect` quando cookie expira mid-sessão
- Captura `connect_error UNAUTHORIZED` → chama `POST /auth/refresh` REST → socket.io reconecta automaticamente
- No `connect`, cliente reemite `room:join { roomId }` → recebe `room:state` fresco → sincroniza TanStack cache

## 6. Frontend — rotas, componentes, hooks

### 6.1 Rotas

```
src/app/
├── rooms/
│   └── join/[code]/
│       ├── page.tsx              ← NOVA, FORA do (app) — link público
│       └── page.test.tsx
└── (app)/
    └── rooms/[id]/
        ├── page.tsx              ← atualiza stub: dispatcher por status
        ├── lobby-view.tsx        ← NOVO
        ├── pending-view.tsx      ← NOVO ("Draft em breve")
        └── page.test.tsx
```

- `/rooms/join/[code]` está fora do `(app)/` guarded group porque link chega a usuário deslogado. A própria page redireciona pra `/login?next=...` quando preciso.
- `/rooms/[id]` continua dentro de `(app)/` — só membros autenticados.

### 6.2 Componentes (`src/components/rooms/`)

| Componente | Responsabilidade |
|---|---|
| `InviteLinkCard` | Mostra `${WEB_ORIGIN}/rooms/join/${code}`, botão "Copiar", toast de feedback |
| `OpponentSlot` | Avatar+nickname do guest, ou skeleton pulsante "Aguardando…" |
| `MatchSummary` | Card resumo da partida (reusa o do catalog em modo compacto se possível) |
| `RoomActions` | Botões contextuais — "Abandonar sala" (host em waiting), "Compartilhar de novo" |

### 6.3 Hooks (`src/hooks/`)

| Hook | Função |
|---|---|
| `useRoom(roomId)` | `useQuery(['room', id], …)`. Substitui o stub atual. Combina com WS pra invalidações realtime. |
| `useRoomPreview(code)` | `useQuery(['room-preview', code], …)`. Sem auth. |
| `useCreateRoom()` | `useMutation`. Recebe `{ matchId }`, redireciona pra `/rooms/<id>`. |
| `useJoinRoom()` | `useMutation`. Recebe `code`, redireciona. |
| `useAbandonRoom()` | `useMutation`. Invalida `useRoom`. |
| `useMyRooms()` | `useQuery(['me', 'rooms'])`. |
| `useRoomSocket(roomId)` | Conecta socket, faz `emit('room:join')`, listeners de `room:state`, `room:guest_joined`, `room:abandoned`, `error`. Sincroniza com TanStack via `setQueryData`. |

### 6.4 Cliente Socket.IO (`src/lib/socket.ts`)

Expande singleton existente:
- `connect()` — verifica auth, abre conexão com `withCredentials: true`
- `disconnect()` — no logout
- Enum `WsClientEvent` / `WsServerEvent` replicados em `src/contracts/ws/enums/`
- Constantes em `src/constants/socket.ts` (`WS_RECONNECT_DELAY_MS`, etc.)

### 6.5 Fluxos principais

**Host cria sala** (`/matches/[id]`):
1. Botão "Criar sala" → `useCreateRoom({ matchId })`
2. API responde `RoomSnapshot` → `router.push('/rooms/' + id)`
3. Lobby chama `useRoom(id)` (snapshot REST) + `useRoomSocket(id)` (WS)
4. Quando WS dispara `room:guest_joined`, query atualiza via `setQueryData` → `OpponentSlot` renderiza guest → page dispatcher detecta `status='DRAFTING'` → renderiza `PendingView`

**Guest abre o link** (`/rooms/join/<code>`):
1. Page chama `useRoomPreview(code)` (público)
2. Mostra "Você foi convidado por @host pra Flamengo×Palmeiras"
3. Botão "Entrar na sala":
   - Se `useAuth().user` é null → `router.push('/login?next=/rooms/join/' + code)`
   - Senão → `useJoinRoom(code)` → redirect pra `/rooms/<id>`
4. Erros tratados com mensagem específica: 404 (não existe), 410 (expirada), 409 ROOM_NOT_OPEN (sala cheia), 409 IS_HOST (você é o host)

**`/me` ganha seção "Minhas salas":**
- `useMyRooms()` → renderiza listas Active + Finished com links pra `/rooms/<id>`

### 6.6 Contracts replicados (`src/contracts/`)

```
src/contracts/
├── rooms/
│   ├── enums/
│   │   ├── room-status.enum.ts       (espelha Prisma RoomStatus)
│   │   ├── room-winner.enum.ts
│   │   ├── role.enum.ts
│   │   └── room-error-code.enum.ts
│   ├── room-snapshot.schema.ts       (Zod)
│   ├── room-preview.schema.ts
│   ├── room-summary.schema.ts
│   ├── create-room.schema.ts
│   └── index.ts
└── ws/
    ├── enums/
    │   ├── ws-client-event.enum.ts
    │   ├── ws-server-event.enum.ts
    │   └── ws-error-code.enum.ts
    └── index.ts
```

Convenção:
```ts
export const RoomStatus = {
  WAITING: 'WAITING',
  DRAFTING: 'DRAFTING',
  LIVE: 'LIVE',
  FINISHED: 'FINISHED',
} as const;
export type RoomStatus = typeof RoomStatus[keyof typeof RoomStatus];
```

Usado tanto em Zod (`z.enum(Object.values(RoomStatus))`) quanto em narrowing TS.

## 7. Estrutura de módulos da API

```
src/modules/rooms/
├── rooms.module.ts
├── rooms.controller.ts
├── rooms.service.ts
├── code-generator.ts
├── room-mappers.ts                       (Prisma row → DTO)
├── rooms.constants.ts                    (ROOM_TTL_AFTER_KICKOFF_MIN=120,
│                                          JOIN_WINDOW_BEFORE_KICKOFF_MIN=-90,
│                                          CODE_CHARSET, CODE_LENGTH=6,
│                                          CODE_GEN_MAX_RETRIES=5,
│                                          RATE_LIMIT_CREATE=10, RATE_LIMIT_JOIN=30,
│                                          MY_ROOMS_FINISHED_LIMIT=20,
│                                          ACTIVE_STATUSES=[WAITING,DRAFTING,LIVE])
├── enums/
│   ├── room-error-code.enum.ts           (MATCH_NOT_FOUND, MATCH_INELIGIBLE,
│   │                                      ROOM_NOT_FOUND, ROOM_NOT_OPEN, ROOM_EXPIRED,
│   │                                      IS_HOST, RACE_LOST, NOT_MEMBER)
│   └── room-event.enum.ts                (EventEmitter topics: ROOM_GUEST_JOINED,
│                                          ROOM_ABANDONED)
├── dto/
│   ├── create-room.dto.ts
│   ├── room-snapshot.dto.ts
│   ├── room-preview.dto.ts
│   ├── room-summary.dto.ts
│   └── my-rooms-query.dto.ts
└── (specs ao lado, seguindo convenção atual do projeto)
```

## 8. Estratégia de testes

### 8.1 API

**Unit** (`src/modules/**/*.spec.ts`):
- `code-generator.spec.ts` — charset, length, distribuição estatística básica
- `rooms.service.spec.ts` — todas as validações com Prisma mockado e EventEmitter mockado
- `room-mappers.spec.ts` — transformações Prisma → DTO
- `ws-auth.middleware.spec.ts` — cookie ausente/inválido/válido
- `ws.gateway.spec.ts` — `@OnEvent` chama `server.to().emit()` com payload correto; `room:join` valida membership

**E2E** (`test/e2e/`):
- `rooms.e2e-spec.ts` — todos os 6 endpoints REST, casos positivos e negativos
- `ws-lobby.e2e-spec.ts` — NOVO. Spin-up Postgres real, dois clientes Socket.IO de verdade (host + guest), valida fluxo: host conecta WS → guest faz REST join → host recebe `room:guest_joined`. Também: host abandon → guest recebe `room:abandoned`. Negativos: connect sem cookie, `room:join` sem membership.

### 8.2 Frontend

**Vitest** (`src/**/*.test.{ts,tsx}`):
- `useRoomSocket.test.ts` — mock socket, valida `emit('room:join')` no mount, cleanup, sincronização TanStack via eventos simulados
- `useRoom.test.ts`
- `lobby-view.test.tsx`, `page.test.tsx` em `/rooms/join/[code]`, `/rooms/[id]`

**Playwright** (`test/e2e/`):
- `room-creation.spec.ts` — dois contextos de browser (host + guest), valida fluxo completo: criar → copiar link → guest abre link → preview → entrar → host vê opponent name aparecer sem refresh (assert < 5s)
- Variante: guest abre link deslogado → cai em login → volta pro preview → entra
- Negativos: link expirado, IS_HOST, recriar sala existente (200, não 201)

### 8.3 Cobertura mínima por endpoint/evento

| Item | Unit | Integration/e2e |
|---|---|---|
| POST /rooms (cria) | ✓ | ✓ |
| POST /rooms (devolve existente) | ✓ | ✓ |
| POST /rooms/:code/join (happy) | ✓ | ✓ |
| POST /rooms/:code/join (race) | ✓ | — (não-determinístico em e2e) |
| POST /rooms/:id/abandon | ✓ | ✓ |
| GET /rooms/:id (membro/não-membro) | ✓ | ✓ |
| GET /rooms/by-code/:code/preview | ✓ | ✓ |
| GET /me/rooms | ✓ | ✓ |
| WS auth handshake | ✓ | ✓ |
| WS room:join (membro/não-membro) | ✓ | ✓ |
| WS room:guest_joined broadcast | — | ✓ |
| WS room:abandoned broadcast | — | ✓ |
| Frontend lobby WS sync | ✓ useRoomSocket | ✓ Playwright |

## 9. Erros — tabela canônica

### 9.1 REST

Shape: `{ statusCode, error, message, code: RoomErrorCode }`.

| Cenário | HTTP | `code` |
|---|---|---|
| Match não existe | 404 | `MATCH_NOT_FOUND` |
| Match não elegível | 409 | `MATCH_INELIGIBLE` |
| Sala não existe | 404 | `ROOM_NOT_FOUND` |
| Sala expirada | 410 | `ROOM_EXPIRED` |
| Sala não está em waiting | 409 | `ROOM_NOT_OPEN` |
| Usuário é o host (join) | 409 | `IS_HOST` |
| Race perdida | 409 | `RACE_LOST` |
| Não-membro | 403 | `NOT_MEMBER` |
| Auth ausente/inválida | 401 | (auth padrão) |
| Rate-limit | 429 | (rate-limit padrão) |

### 9.2 WS

Shape: `{ code: WsErrorCode, message: string }`.

| Cenário | `code` | Disconnect? |
|---|---|---|
| Handshake sem cookie / inválido | `UNAUTHORIZED` | sim (connect rejeitado) |
| `room:join` em sala inexistente | `ROOM_NOT_FOUND` | não |
| `room:join` em sala que user não é membro | `NOT_MEMBER` | sim |
| Payload inválido (Zod safeParse falhou) | `VALIDATION` | não |
| Erro interno inesperado | `INTERNAL` | não |

## 10. Edge cases

1. **Refresh do link após guest já entrou:** preview devolve `status=DRAFTING`; UI mostra "Sala em andamento" + (se user é membro) link pra `/rooms/<id>`.
2. **Host clica no próprio link:** `IS_HOST` → UI diz "Você é o anfitrião" + link direto.
3. **Host fecha aba antes de guest entrar:** sala continua viva; `/me/rooms` permite voltar.
4. **WS reconnect mid-lobby:** auto-reconnect do socket.io; cliente reemite `room:join` no `connect`; servidor responde com `room:state` fresco.
5. **Cookie expira durante lobby:** `connect_error UNAUTHORIZED` → `POST /auth/refresh` → reconectar.
6. **Sala expira enquanto host olha:** sem countdown no MVP; refetch periódico do snapshot (60s) revela o estado expirado.
7. **Duas abas do mesmo usuário:** ambos sockets entram no canal, ambos recebem eventos. Sem problema.
8. **Match vira POSTPONED depois da sala criada:** sala em waiting continua viva até `expires_at`. Joins novos rejeitados com `MATCH_INELIGIBLE`. Tratamento mais elaborado nas próximas verticals.
9. **Host abandona em waiting:** `status → FINISHED`, `winner = null`. Aparece em `/me/rooms?status=finished`. Link velho retorna `ROOM_NOT_OPEN`.

## 11. Telemetria

Logs estruturados via Pino (sem dashboards novos):
- `room.created` `{ roomId, hostId, matchId, code }`
- `room.joined` `{ roomId, guestId, code }`
- `room.abandoned` `{ roomId, by, status }`
- `ws.connected` / `ws.disconnected` `{ userId, reason }`
- `ws.handshake_rejected` `{ reason: WsErrorCode }`

## 12. Critérios de aceite (DoD)

### API
- [ ] Migration aplicada (partial unique index `uniq_host_match_active`) + e2e roda em CI
- [ ] 6 endpoints REST funcionando com validação Zod
- [ ] WsModule conecta com cookie auth; broadcasts `room:guest_joined` e `room:abandoned` funcionam
- [ ] Unit spec por service/middleware + e2e `ws-lobby.e2e-spec.ts` rodando
- [ ] Rate-limit aplicado nos POSTs sensíveis
- [ ] `npm test`, `npm run test:e2e`, `npm run lint` verdes
- [ ] CI verde (mesmo workflow do catalog)

### Frontend
- [ ] `/matches/[id]` tem botão "Criar sala" funcional
- [ ] `/rooms/join/[code]` mostra preview e botão "Entrar"; trata todos os erros listados
- [ ] `/rooms/[id]` renderiza lobby quando WAITING; `PendingView` em DRAFTING/LIVE/FINISHED
- [ ] `/me` lista active+finished rooms
- [ ] WS conecta após login, sincroniza `room:guest_joined` em < 2s no Playwright
- [ ] `useRoomSocket` unit + Playwright happy path com dois contextos
- [ ] `npm test`, `npm run test:e2e`, `npm run lint` verdes

## 13. Fora de escopo (próximas verticals)

- Snake draft (vertical 4): handlers WS `draft:pick`, `draft:current_pick`, `draft:pick_made`, validações de turno e posição
- Partida ao vivo (vertical 5): `match:event`, `match:score_updated`, substituições
- Notificação push do guest entrando (depende de PWA)
- Histórico estatístico em `/me` (W/L, salas por mês — vertical 6)
- Pacote `@draft-duel/contracts` formal (continua copy-paste)

## 14. Estratégia de packaging

Dois PRs paralelos (mesmo padrão da vertical de catálogo):
- **API**: `feat/room-creation-api` — migration + RoomsModule + WsModule + testes
- **Frontend**: `feat/room-creation-frontend` — rotas + componentes + hooks + Playwright

Frontend pode mergear depois do API (precisa do API rodando localmente pra Playwright). Não há dependência reversa.
