# Draft Duel — Design da Recriação

**Data:** 2026-05-01
**Status:** Spec aprovado, pronto pra fase de plano de implementação
**Deadline implícito:** Copa do Mundo 2026 (kickoff 11 de junho de 2026)

---

## 1. Resumo executivo

O Draft Duel existe hoje como protótipo (`pick-em-play`, gerado via Lovable) e prova um conceito: **draft snake 1v1 baseado em partidas reais de futebol, com pontuação derivada das ações dos atletas em campo**. Esse spec define a recriação do produto como sistema profissional, em dois repositórios próprios:

- `draft-duel-game-api` — backend Nest.js + Fastify
- `draft-duel-game-frontend` — frontend Next.js + React

O MVP suporta **1v1 com amigos via sala+código** em partidas ao vivo do Brasileirão e Copa do Mundo, com lançamento alvo durante a Copa 2026. Funcionalidades pós-MVP (gamificação com moeda virtual, apostas, ligas, ranking) ficam fora do escopo deste spec.

---

## 2. Decisões de produto

### 2.1 Modos e mecânica do MVP

- **Modo único:** 1v1 com amigos. Host cria sala (recebe código de 6 caracteres), guest entra com o código.
- **Vinculação a partida real:** toda sala referencia uma partida agendada (Brasileirão ou Copa do Mundo).
- **Janela de criação:** sala pode ser criada a partir de **1h antes do kickoff** (escalações tipicamente confirmadas) **até a partida terminar** — late-join permitido.
- **Pool de draft:** atletas escalados (titulares confirmados) das duas equipes da partida.
- **Draft:** snake, 5 picks por jogador, 1 atleta por posição obrigatória (`GOL, LAT, ZAG, MEI, ATA`). Total 10 picks. Sem timer (deliberado — protótipo validou; reintroduzir se virar problema na produção).
- **Substituições:** ilimitadas durante a partida live. Modelo **ownership**: cada atleta soma pontos só enquanto está no time daquele role.
- **Pontuação retroativa pra late-joiners:** todos os eventos da partida real desde o kickoff contam pra quem draftou (stats visíveis no draft).
- **Histórico:** salas finalizadas ficam visíveis no perfil do usuário.
- **Visual:** mantém direção do protótipo (dark, JerseyIcon, animações), recriado em Next + Tailwind.

### 2.2 Pontuação

A API de stats (paga, fornecedor a definir) entrega **ações cruas** ("Pedro fez gol"). O cálculo de pontos é **nosso**: tabela `scoring_rules` no Postgres mapeia `action → points`. Mudança de ponderação não exige deploy. Cálculo do placar acontece em **TypeScript no backend** (função pura, recalculada a cada novo evento ou substituição).

### 2.3 Autenticação

- Magic link only (sem senha, sem OAuth no MVP).
- Provider de email: Resend.
- Tokens single-use, expiram em 15 min.
- Sessão: cookie httpOnly com access JWT (15 min) + refresh token opaco (30 dias).

### 2.4 Catálogo

- Múltiplos campeonatos suportados desde o dia 1: **Brasileirão** e **Copa do Mundo**.
- Tela inicial: usuário escolhe campeonato → vê lista de jogos da rodada atual.

### 2.5 Restrições

- **Sem direito de imagem oficial:** logos de time genéricas em SVG (hospedadas por nós), sem foto de atleta. UI usa `JerseyIcon` (camisa colorida + número).

---

## 3. Decisões técnicas (alto nível)

| Camada | Escolha |
|---|---|
| Backend | Nest.js + Fastify, Prisma ORM, Pino logger |
| Frontend | Next.js (App Router), React, Tailwind, shadcn/ui, TanStack Query, Framer Motion |
| Real-time | Socket.IO (cliente + server) |
| Banco | Postgres (Neon) — fonte única da verdade |
| Email | Resend |
| Hosting API | Fly.io (WebSocket persistente, região Brasil) |
| Hosting Web | Vercel (com rewrite proxying API → mesmo origin pra cookies) |
| Repos | 2 repos separados + pacote `@draft-duel/contracts` (npm privado ou copy via CI) |
| CI/CD | GitHub Actions |

**Modo de operação no MVP:** API single-instance. Stateless por design (Postgres autoritativo). Escalada horizontal vira viável adicionando Redis (Socket.IO Redis adapter + leader election do scheduler) — ~1 dia de trabalho quando necessário.

**Fora do MVP:** Redis, BullMQ, multi-instance, Sentry, observabilidade avançada, OAuth, magic link via SMS, ranking, ligas, moeda virtual.

---

## 4. Arquitetura geral

```
┌──────────────────────┐                ┌──────────────────────────────────┐
│  Frontend (Next.js)  │                │  Backend (Nest + Fastify)        │
│                      │  HTTPS REST    │  ┌────────────────────────────┐  │
│  Pages/UI            │ ◀────────────▶ │  │ HTTP Controllers           │  │
│  React Query         │                │  └────────────────────────────┘  │
│  Socket.IO client    │  WebSocket     │  ┌────────────────────────────┐  │
│                      │ ◀════════════▶ │  │ WS Gateway (Socket.IO)     │  │
└──────────────────────┘                │  └────────────────────────────┘  │
                                        │  ┌────────────────────────────┐  │
                                        │  │ Domain Services            │  │
                                        │  │ Auth, Catalog, Room, Draft,│  │
                                        │  │ Match, Scoring             │  │
                                        │  └────────────────────────────┘  │
                                        │  ┌────────────────────────────┐  │
                                        │  │ StatsProvider (interface)  │  │
                                        │  │  ↳ Stub | Vendor TBD       │  │
                                        │  └────────────────────────────┘  │
                                        │  ┌────────────────────────────┐  │
                                        │  │ Workers / Schedulers       │  │
                                        │  │ LiveMatchPoller (10s) +    │  │
                                        │  │ Lineup/Calendar/Catalog/   │  │
                                        │  │ RoomExpiration             │  │
                                        │  └────────────────────────────┘  │
                                        └──────────────┬───────────────────┘
                                                       │
                                            ┌──────────▼───────────┐
                                            │  Postgres (Neon)     │
                                            │  fonte da verdade    │
                                            └──────────────────────┘
```

### 4.1 Princípios

- **Postgres autoritativo.** Cliente nunca escreve direto no DB. WS apenas transporta intenções (ex: `draft:pick`); backend valida, persiste, broadcasta.
- **Stateless API.** Nenhum estado de sala vive em memória da instância — qualquer instância serve qualquer requisição. Escalada horizontal pronta (precisa só de Redis adapter quando for ligar 2+ instâncias).
- **Diff-based broadcast.** Worker de polling consulta API de stats, persiste eventos novos (idempotente via `provider_external_id`), e dispara broadcast somente dos eventos que mudaram o estado.
- **StatsProvider abstrato.** Toda integração com fornecedor passa por uma interface; troca de fornecedor é troca de classe.

---

## 5. Modelo de dados (Postgres)

### 5.1 Identidade

```
users                       magic_link_tokens                sessions
─────                       ─────────────────                ────────
id (uuid pk)                id (uuid pk)                     id (uuid pk)
email (unique)              email                            user_id (fk users)
nickname                    token_hash                       refresh_token_hash
created_at                  expires_at (15 min)              expires_at
last_login_at               consumed_at (nullable)           created_at, last_used_at
                            created_at
```

### 5.2 Catálogo (sincronizado pela API de stats)

```
championships               rounds                       teams
─────────────               ──────                       ─────
id (uuid pk)                id (uuid pk)                 id (uuid pk)
slug (unique:               championship_id (fk)         external_id (per provider)
  brasileirao,              number                       name, short_name
  copa-mundo)               name                         abbreviation
name                        starts_at, ends_at           crest_url (genérica nossa, nullable)
kind (league|cup)           external_id
external_id

athletes                                 matches
────────                                 ───────
id (uuid pk)                             id (uuid pk)
external_id                              championship_id (fk)
team_id (fk)                             round_id (fk)
name, short_name                         home_team_id, away_team_id (fk teams)
position (GOL|LAT|ZAG|MEI|ATA)           kickoff_at
jersey_number (nullable)                 status (scheduled|live|finished|postponed)
                                         current_minute (nullable)
                                         home_score, away_score (nullable)
                                         lineups_confirmed_at (nullable)
                                         external_id

match_lineups                            match_events
─────────────                            ────────────
id (uuid pk)                             id (uuid pk)
match_id (fk)                            match_id (fk)
team_id (fk)                             athlete_id (fk)
athlete_id (fk)                          action (enum)
is_starter (bool)                        minute (int)
jersey_number                            occurred_at
                                         provider_external_id
                                         raw_payload (jsonb)
                                         UNIQUE(match_id, provider_external_id)

scoring_rules
─────────────
action (pk, enum)
points (numeric)
applies_to (all|GK|field)
```

### 5.3 Sala / gameplay

```
rooms                                    draft_picks
─────                                    ───────────
id (uuid pk)                             id (uuid pk)
code (unique, 6-char)                    room_id (fk)
match_id (fk)                            pick_number (0..9)
host_user_id (fk users)                  role (host|guest)
guest_user_id (fk users, nullable)       athlete_id (fk)
status (waiting|drafting|live|finished)  made_at
current_pick_number (int)
host_score, guest_score (cached)         substitutions
draft_started_at, draft_finished_at      ─────────────
match_started_at, match_finished_at      id (uuid pk)
winner (host|guest|draw|abandoned, null) room_id (fk)
created_at, expires_at                   role (host|guest)
                                         removed_athlete_id (fk)
                                         added_athlete_id (fk)
                                         applied_at_minute (int)
                                         applied_at (timestamptz)

room_lineup_intervals  ← chave do modelo "ownership"
─────────────────────
id (uuid pk)
room_id (fk)
role (host|guest)
athlete_id (fk)
valid_from_minute (int)         -- minuto da partida real
valid_to_minute (int, nullable) -- NULL enquanto ativo
```

### 5.4 Modelo de ownership

`room_lineup_intervals` registra **propriedade de cada atleta no time de cada role ao longo do tempo**.

- **Draft termina:** insere 1 row por pick — `(role, athlete, from=0, to=NULL)`. (`from=0` mesmo se o draft acabou no minuto 30 — pontos contam desde o kickoff por regra do produto.)
- **Sub no minuto Y:** fecha row do que sai (`to=Y`), insere row do que entra (`from=Y, to=NULL`).
- **Match termina:** fecha todos os intervalos abertos com `to = current_minute_final`.

**Cálculo de placar (TypeScript, função pura):**

```
score(role) =
  Σ scoring_rules[event.action].points
  para cada (event, interval) onde
    interval.room_id = roomId AND
    interval.role = role AND
    event.match_id = room.match_id AND
    event.athlete_id = interval.athlete_id AND
    event.minute >= interval.valid_from_minute AND
    (interval.valid_to_minute IS NULL OR event.minute < interval.valid_to_minute)
```

Resultado materializado em `rooms.host_score / guest_score` como cache (recalculado a cada novo evento ou sub). Função bate com SQL equivalente quando precisar de auditoria.

### 5.5 Indexes principais

- `users`: unique(email)
- `magic_link_tokens`: idx(email, expires_at), idx(token_hash)
- `sessions`: idx(user_id), idx(refresh_token_hash)
- `matches`: idx(championship_id, kickoff_at), idx(status), idx(external_id)
- `match_events`: unique(match_id, provider_external_id), idx(match_id, minute)
- `rooms`: unique(code), partial idx where status != 'finished', idx(host_user_id), idx(guest_user_id), idx(match_id)
- `room_lineup_intervals`: idx(room_id, role), partial idx where valid_to_minute IS NULL
- `draft_picks`: unique(room_id, pick_number)

---

## 6. Lifecycle da sala

### 6.1 Máquina de estados

```
                      ┌─────────────┐
   POST /rooms ─────▶ │   waiting   │
                      └──────┬──────┘
                             │ POST /rooms/:code/join
                             ▼
                      ┌─────────────┐
                      │  drafting   │ ◀── snake draft, 10 picks
                      └──────┬──────┘
                             │ último pick
                             ▼
                      ┌─────────────┐
                      │    live     │ ◀── eventos chegam, subs ilimitadas
                      └──────┬──────┘
                             │ poller detecta partida real
                             │ status='finished'
                             ▼
                      ┌─────────────┐
                      │  finished   │
                      └─────────────┘
```

### 6.2 Transições

**`waiting → drafting`** (guest entra com código)
- Validação atômica via UPDATE com WHERE: `UPDATE rooms SET status='drafting', guest_user_id=$id, draft_started_at=now(), current_pick_number=0 WHERE id=$id AND status='waiting'`. Se affected rows = 0, alguém ganhou a corrida → 409.
- Validações: code existe, fixture ainda elegível (kickoff > now-90min ou status='live'), guest != host.
- Emite `room:guest_joined` + `draft:current_pick { pickNumber: 0, role: 'host' }`.

**Durante `drafting`** (cada pick — cliente emite `draft:pick`)
- Validações:
  - É a vez deste role (snake order — round par: host primeiro; round ímpar: guest primeiro)
  - Atleta está em `match_lineups` da fixture
  - Atleta não foi draftado nessa sala
  - Posição do atleta é uma que o role ainda não preencheu
- Em transação: insere `draft_picks`, incrementa `current_pick_number`.
- Emite `draft:pick_made` + `draft:current_pick` (ou ativa transição pra `live` se foi o 10º).

**`drafting → live`** (último pick)
- Em transação:
  - Cria 10 rows em `room_lineup_intervals` (5 por role, todos `valid_from_minute=0, valid_to_minute=NULL`)
  - `UPDATE rooms SET status='live', draft_finished_at=now(), match_started_at=now()`
- Emite `match:started` com snapshot de lineup.

**Durante `live`**
- **Evento da partida real (poller):** persiste em `match_events` → recalcula score → emite `match:event` + `match:score_updated`.
- **Substituição (cliente emite `match:substitute`):**
  - Validações: role tem o atleta a remover num intervalo aberto, novo atleta está em `match_lineups`, mesma posição, não está em outro intervalo aberto da sala.
  - Em transação: fecha intervalo do que sai (`valid_to_minute = matches.current_minute`), abre intervalo do que entra, insere `substitutions` (audit).
  - Recalcula score, emite `match:substitution_applied` + `match:score_updated`.

**`live → finished`** (poller detecta `matches.status='finished'`)
- Pra cada room live com esse `match_id`:
  - Fecha todos `room_lineup_intervals` abertos com `valid_to_minute = matches.current_minute`.
  - Recalcula score final, persiste em `rooms.host_score/guest_score`, define `winner`.
  - `UPDATE rooms SET status='finished', match_finished_at=now()`.
  - Emite `match:finished`.

**Abandono e expiração**
- `POST /rooms/:id/abandon`: jogador presente abandona → sala vira `finished`, `winner` = adversário (ou `draw` se ambos abandonarem).
- Cron `RoomExpirationWorker` (1min): salas com `expires_at < now AND status != finished` viram `finished` com `winner='abandoned'`.

### 6.3 Determinação do "minuto atual"

Pra subs e fechamento de intervalos, o sistema usa `matches.current_minute`, atualizado pelo poller a cada ciclo. Quando partida real ainda não começou, é `null`; subs pedem o minuto atual e usam `0` como fallback (não deveria acontecer porque a sala não está em `live` antes do kickoff).

---

## 7. Contratos REST e WebSocket

### 7.1 REST

Auth:

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/magic-link` | `{ email }` → 204 sempre (anti-enumeration) |
| POST | `/auth/verify` | `{ token }` → cria/atualiza user, seta cookies httpOnly |
| POST | `/auth/refresh` | rotaciona refresh, devolve novo access |
| POST | `/auth/logout` | invalida sessão atual |
| GET | `/me` | `{ id, email, nickname }` |
| PATCH | `/me` | `{ nickname }` |

Catálogo:

| Método | Rota | Descrição |
|---|---|---|
| GET | `/championships` | lista campeonatos ativos |
| GET | `/championships/:slug/current-round` | rodada atual + partidas |
| GET | `/matches/:id` | detalhe da partida |
| GET | `/matches/:id/lineups` | escalações (quando confirmadas) |

Salas:

| Método | Rota | Descrição |
|---|---|---|
| POST | `/rooms` | `{ matchId }` → cria, retorna `{ id, code }`, status=waiting |
| POST | `/rooms/:code/join` | guest entra, retorna `{ roomId, role: 'guest' }` |
| GET | `/rooms/:id` | snapshot completo da sala |
| POST | `/rooms/:id/abandon` | encerra |
| GET | `/me/rooms?status=active|finished` | minhas salas |

### 7.2 WebSocket (Socket.IO)

**Auth no handshake:** middleware lê cookie `dd_access`, valida JWT, atribui `socket.data.user`.

**Salas WS:** ao receber `room:join` autenticado, server faz `socket.join('room:'+roomId)` (verifica que user é host ou guest da sala).

**Eventos cliente → server:**

| Evento | Payload | Descrição |
|---|---|---|
| `room:join` | `{ roomId }` | entra na sala WS, recebe `room:state` |
| `room:leave` | `{ roomId }` | sai da sala WS (não abandona a sala lógica) |
| `draft:pick` | `{ roomId, athleteId }` | faz pick (válido só na vez do role) |
| `match:substitute` | `{ roomId, removeAthleteId, addAthleteId }` | substitui atleta |

**Eventos server → cliente (broadcast pra `room:<id>`):**

| Evento | Payload (resumo) | Quando |
|---|---|---|
| `room:state` | snapshot completo | sob demanda em `room:join` ou reconnect |
| `room:guest_joined` | `{ guest, status }` | guest entrou |
| `draft:pick_made` | `{ pickNumber, role, athleteId }` | depois de cada pick |
| `draft:current_pick` | `{ pickNumber, role }` | quem tem a vez |
| `match:started` | `{ startedAt, lineup }` | última pick → live |
| `match:event` | `{ eventId, athleteId, action, minute, points, affectedRole }` | novo evento |
| `match:score_updated` | `{ hostScore, guestScore }` | sempre que score muda |
| `match:substitution_applied` | `{ role, removedAthleteId, addedAthleteId, minute }` | sub aplicada |
| `match:finished` | `{ hostScore, guestScore, winner }` | partida acabou |
| `room:abandoned` | `{ by, winner }` | alguém abandonou |
| `error` | `{ code, message }` | validação falhou |

### 7.3 Sincronização e reconexão

- Cliente trata `room:state` como verdade absoluta. Em qualquer dúvida, reemite `room:join` e reconcilia com snapshot.
- Eventos individuais são patches incrementais.
- Cookie de auth expirou em conexão WS aberta → cliente recebe `disconnect` → faz `POST /auth/refresh` REST → reconecta. Socket.IO faz reconnect automático.

### 7.4 Validação dos contratos

Schemas Zod no pacote `@draft-duel/contracts`:
- DTOs REST (request + response) — Nest aplica via `ZodValidationPipe`
- Payloads WS — gateway valida `data` em cada handler com `safeParse`
- Front consome os mesmos schemas (type-safe + validação de runtime)

---

## 8. StatsProvider e workers

### 8.1 Interface `StatsProvider`

```ts
interface StatsProvider {
  // Catálogo (sync raro, ~1x/dia)
  fetchChampionships(): Promise<ChampionshipDto[]>
  fetchTeams(championshipExternalId: string): Promise<TeamDto[]>
  fetchAthletes(teamExternalId: string): Promise<AthleteDto[]>

  // Calendário (sync sob demanda + horário)
  fetchRounds(championshipExternalId: string): Promise<RoundDto[]>
  fetchMatchesByRound(championshipExternalId: string, roundNumber: number): Promise<MatchDto[]>

  // Pré-jogo (~1h antes do kickoff)
  fetchMatchLineups(matchExternalId: string): Promise<MatchLineupDto>

  // Live (polling 10s)
  fetchMatchLive(matchExternalId: string): Promise<MatchLiveDto>
}

type MatchLiveDto = {
  status: 'scheduled' | 'live' | 'finished' | 'postponed'
  currentMinute: number | null
  homeScore: number
  awayScore: number
  events: Array<{
    externalId: string         // chave de idempotência
    athleteExternalId: string
    action: ActionType
    minute: number
    occurredAt: string
  }>
}
```

### 8.2 Implementações

- **`StubStatsProvider`** — devolve dados fake com shape realista. Permite desenvolver fluxo end-to-end **antes do contrato com fornecedor**. Modo "simulador" faz partida progredir no tempo (5s = 1min de jogo) gerando eventos aleatórios.
- **`<Vendor>StatsProvider`** — implementação real, instalada quando o fornecedor for definido. Testada contra mocks HTTP.

Seleção via env: `STATS_PROVIDER=stub|<vendor>`.

### 8.3 Workers

| Worker | Cadência | Função |
|---|---|---|
| `LiveMatchPoller` | 10s | Poll de partidas ativas, persiste eventos novos, dispara broadcast |
| `LineupSyncWorker` | 15min | Pra matches com kickoff em [now, now+4h] sem `lineups_confirmed_at`, busca escalação |
| `CalendarSyncWorker` | 6h | Sync de rodada atual + partidas por campeonato |
| `CatalogSyncWorker` | 1x/dia (5h) | Sync de campeonatos, teams, athletes |
| `RoomExpirationWorker` | 1min | Fecha salas com `expires_at < now` e `status != finished` |

REST endpoints também checam staleness e disparam sync sob demanda quando necessário.

### 8.4 `LiveMatchPoller` — detalhes

Pseudocódigo:

```
@Cron('*/10 * * * * *')
async pollLiveMatches() {
  if (lock.isLocked()) return            // evita reentrada
  await lock.acquire()
  try {
    matches = matchesRepo.findPollable()
    // critérios:
    //  - status='live'
    //  - status='scheduled' E kickoff em [now-5min, now+90min]
    //  - status='finished' E match_finished_at em [now-5min, now] (buffer)

    results = await Promise.allSettled(
      matches.map(m => statsProvider.fetchMatchLive(m.externalId))
    )

    for (match, result) in zip(matches, results):
      if result.rejected: log; continue
      applyLiveData(match, result.value)
  } finally {
    lock.release()
  }
}

applyLiveData(match, live):
  matchesRepo.updateLive(match.id, live)
  existing = eventsRepo.existingProviderIds(match.id)
  newEvents = live.events.filter(e => not in existing)
  if newEvents.empty: return

  eventsRepo.insertBatch(match.id, newEvents)
  rooms = roomsRepo.findLiveByMatch(match.id)
  for room in rooms:
    matchOrchestrator.handleNewEvents(room.id, newEvents)
    // recalcula score, emite match:event + match:score_updated

  if live.status == 'finished' and match.status != 'finished':
    for room in rooms:
      matchOrchestrator.closeRoom(room.id)
```

### 8.5 Garantias

- **Idempotência:** `match_events` tem unique `(match_id, provider_external_id)`. Reprocessar não duplica.
- **Reentrância:** lock em memória previne dois ciclos sobrepostos. Em multi-instance, leader election ou worker isolado (fora do MVP).
- **Falha por match isolada:** `Promise.allSettled` evita que um provider error em uma partida derrube todas. Próximo ciclo é o retry.
- **Eventos retroativos do fornecedor:** se a API mandar evento com minuto antigo, o sistema processa: `affectedRole` é determinado pelos `room_lineup_intervals` (que sabem dono no minuto Y).
- **Multiplexação:** uma chamada à API por partida real, mesmo que N salas estejam acompanhando. Custo por sala = 0 chamadas extras.

---

## 9. Fluxo de autenticação (magic link)

### 9.1 Sequência

1. **POST /auth/magic-link `{ email }`**
   - Rate limit (3/hora/email + 10/hora/IP)
   - Gera token aleatório (32 bytes, base64url)
   - INSERT `magic_link_tokens` (email, `token_hash=sha256(token)`, `expires_at=now()+15min`)
   - Envia email via Resend com link `https://<web>/auth/verify?token=<token>`
   - Sempre 204 (não revela se email existe)

2. **Usuário clica no email** → frontend `/auth/verify?token=...` → chama POST.

3. **POST /auth/verify `{ token }`**
   - Procura token: `WHERE token_hash=sha256($token) AND expires_at > now() AND consumed_at IS NULL`
   - Se válido: `UPDATE consumed_at=now()` (single-use)
   - Busca user por email; se não existe, INSERT (`nickname` = parte antes do `@`, editável depois)
   - Cria sessão: `refresh_token` (32 bytes opaco), `expires_at=now()+30d`, INSERT `sessions`
   - Gera access JWT (15 min)
   - Seta cookies httpOnly:
     - `dd_access` (HttpOnly, Secure, SameSite=Lax, 15 min)
     - `dd_refresh` (HttpOnly, Secure, SameSite=Lax, 30 dias, path=`/auth/refresh`)
   - Retorna `{ user }`

4. **Requisições subsequentes**
   - Middleware Nest valida `dd_access` → injeta `request.user`
   - Quando expirar: cliente chama POST `/auth/refresh` (com `dd_refresh`) → rotaciona refresh, gera novo access
   - Refresh inválido → 401, força novo magic link

### 9.2 WebSocket auth

Socket.IO handshake transmite cookies. Middleware do gateway valida `dd_access`; se inválido, rejeita. Em desconexão por expiração, cliente faz refresh REST e reconecta.

### 9.3 Cross-domain / cookies

Web em `draftduel.com`, API em `api.draftduel.com`: cookies precisam do parent domain (`.draftduel.com`), Secure + SameSite=Lax. CORS API com `credentials: true`.

**Alternativa preferida:** rewrite no Vercel mapeando `/api/*` → backend Fly. Mesma origem, sem dor de CORS/cookies. Decidir no deploy.

### 9.4 Email

- Provider: Resend
- Domínio próprio com SPF + DKIM + DMARC
- Template HTML + plain text, CTA grande
- Falha de envio: log + responde 204 (não revela)

---

## 10. Estrutura dos repositórios

### 10.1 `draft-duel-game-api`

```
src/
├── main.ts
├── app.module.ts
├── modules/
│   ├── auth/                 (magic link, sessions, JWT, guards)
│   ├── catalog/              (championships, rounds, matches, athletes — REST + sync)
│   ├── rooms/                (REST de salas + lifecycle)
│   ├── draft/                (regras de pick, snake, validação)
│   ├── match/                (orchestrator de partida live, subs, intervalos)
│   ├── scoring/              (função pura de cálculo de placar)
│   ├── stats/                (StatsProvider interface + Stub + Vendor TBD)
│   ├── workers/              (LiveMatchPoller, LineupSync, CalendarSync, CatalogSync, RoomExpiration)
│   └── ws/                   (Gateway Socket.IO + middleware auth)
├── common/
│   ├── config/               (env validado com Zod)
│   ├── db/                   (Prisma module)
│   ├── logger/               (Pino)
│   └── errors/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── test/
    ├── unit/                 (services, scoring, snake, validators)
    ├── integration/          (Postgres real via Testcontainers)
    └── e2e/                  (REST + WS, sala completa do fim ao fim)
```

### 10.2 `draft-duel-game-frontend`

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      (home → escolha de campeonato)
│   ├── (auth)/
│   │   ├── login/page.tsx            (input de email)
│   │   ├── verify/page.tsx           (consome ?token=)
│   │   └── layout.tsx
│   └── (app)/
│       ├── layout.tsx
│       ├── championships/[slug]/page.tsx
│       ├── matches/[id]/page.tsx
│       ├── rooms/[id]/page.tsx
│       └── me/page.tsx
├── components/
│   ├── JerseyIcon.tsx
│   ├── PlayerCard.tsx
│   ├── DraftBoard.tsx
│   ├── MatchScoreboard.tsx
│   ├── MatchTimeline.tsx
│   ├── SubstitutionDialog.tsx
│   └── ui/
├── hooks/
│   ├── useAuth.ts
│   ├── useSocket.ts
│   └── useRoom.ts
├── lib/
│   ├── api.ts
│   ├── socket.ts
│   └── auth.ts
└── styles/

test/
├── unit/                (Vitest)
└── e2e/                 (Playwright)
```

### 10.3 Pacote `@draft-duel/contracts`

Schemas Zod e tipos compartilhados, **definidos uma vez**, consumidos por ambos os repos:

- `src/rest/` — schemas Zod por endpoint (request + response)
- `src/ws/` — schemas Zod por evento WS
- `src/domain/` — enums (`POSITIONS`, `ACTION_LABELS`), tipos compartilhados

**Forma de distribuição (decidir na fase de implementação):** publicar no GitHub Packages (npm registry privado) com bumps de versão via changesets, OU script no CI da API que gera arquivo único e copia pro front. A primeira tem rastreabilidade melhor; a segunda tem zero overhead. Não bloqueia o resto do design.

---

## 11. Estratégia de testes

### 11.1 API (alta prioridade)

- **Unit:** snake order, scoring (com fixtures de eventos+intervalos), validação de pick e sub, magic link auth flow
- **Integration:** repositórios contra Postgres real (Testcontainers), idempotência do polling, atomicidade de transações críticas (guest join, pick, sub)
- **E2E:** "duas usuárias, draft 10 picks, eventos chegam, subs ilimitadas, fim" — cliente WS + REST de teste

### 11.2 Frontend (média prioridade)

- **Unit (Vitest):** componentes críticos (DraftBoard, PlayerCard, JerseyIcon, MatchScoreboard, MatchTimeline)
- **E2E (Playwright):** smoke do fluxo completo contra API local (com `StubStatsProvider`)

### 11.3 Stub StatsProvider como fixture viva

`StubStatsProvider` serve simultaneamente como ambiente de dev e de E2E. Roda partida em tempo acelerado e injeta eventos realistas. Permite validar todas as transições do lifecycle sem fornecedor.

---

## 12. Deploy e CI/CD

| Camada | Plataforma |
|---|---|
| API | Fly.io (região GRU) |
| Web | Vercel (com rewrite `/api/*` → Fly) |
| Postgres | Neon (branching pra preview deploys) |
| Email | Resend |
| CI/CD | GitHub Actions |

Workflows:
- **PR:** lint + tests (unit + integration) em ambos os repos
- **Push to main (api):** build + push image → deploy Fly + run migrations
- **Push to main (frontend):** Vercel deploy automático

Env vars validadas com Zod no boot. Secrets em Fly secrets / Vercel env.

### 12.1 Domínio

`draftduel.com` (placeholder). Confirmar no momento do deploy.

### 12.2 Observabilidade (não-MVP, planejada pra v1.5)

- Logs JSON estruturados via Pino (Fly coleta stdout)
- Sentry (front + back, free tier)
- Alertas básicos: API down, taxa de erro de polling, latência alta

---

## 13. Riscos e tradeoffs

### 13.1 Riscos de prazo

- **Auth próprio do zero** custa ~1 semana (magic link, email entregabilidade, refresh, rate limit). Se o prazo apertar, fallback é Clerk/Better Auth — adia o "tudo nosso" pra v2.
- **Fornecedor de stats indefinido.** Se o contrato não fechar até a Copa, lança usando `StubStatsProvider` em modo simulador (não é o produto que queremos, mas é jogável). Risco aceitável de descoberta.
- **Cookies cross-domain.** Pode ter atrito com Safari ITP / Brave. Mitigação: rewrite no Vercel pra mesma origem (recomendado).

### 13.2 Riscos de produto

- **Sem timer de pick:** se um lado fica AFK, sala trava até alguém abandonar. Aceito como hipótese a validar; reabrir se virar problema real.
- **Stats visíveis no draft + late-join:** quem entra no 60' tem vantagem de informação ("vejo quem já pontuou"). Aceito por design.
- **Subs ilimitadas + ownership:** modelo coerente, mas exige UX clara ("você só ganha pontos enquanto o atleta é seu") senão vira frustração.

### 13.3 Tradeoffs arquiteturais

- **Single-instance no MVP.** Não escala além de ~2.500 partidas concorrentes. Sair disso é 1 dia de Redis adapter, mas é sair. Aceito.
- **Cálculo de placar em TS, não SQL.** Custo de pulling dados (intervals + events) é negligível pra 1v1; ganho é testabilidade e clareza de evolução.
- **Sem Redis no MVP.** Quando precisar de horizontal scaling, será adição (não refatoração).
- **Dois repos vs monorepo.** Atrito de tipos compartilhados resolvido por pacote contracts. Se virar dor, reconsolidar em monorepo é viável.

---

## 14. Próximos passos

1. **Plano de implementação** — invocar `writing-plans` pra detalhar passos executáveis (este spec é o input).
2. **Decisões pendentes resolvíveis na implementação:**
   - Forma exata de distribuição do pacote contracts (npm privado vs. copy via CI)
   - Domínio de produção (`draftduel.com` é placeholder)
   - Detalhes de UI dentro de cada tela (paridade com protótipo é o ponto de partida)
3. **Gating do v2 (pós-Copa):**
   - Fornecedor de stats real (substituir Stub)
   - Gamificação: moeda virtual, apostas entre amigos, recompensa por atividade
   - Ranking global, ligas, torneios

---

## Apêndice A — Decisões fixadas na fase de brainstorm

1. Refundação como produto novo (não migração 1:1 do protótipo)
2. MVP = 1v1 com amigos via sala+código
3. Múltiplos campeonatos desde o dia 1 (Brasileirão + Copa do Mundo)
4. Stack: Nest+Fastify (api), Next+React (front), Postgres direto, auth próprio
5. Postgres autoritativo, backend valida e persiste, broadcast pós-write
6. Polling 10s da API de stats, multiplexado por partida real
7. Pontuação calculada em TypeScript via `scoring_rules` em DB
8. Janela de criação 1h antes do kickoff até fim, late-join permitido
9. Stats visíveis no draft, pontos retroativos desde o kickoff
10. Snake draft, 5 picks (1 por posição), sem timer
11. Subs ilimitadas, modelo ownership (pontua só enquanto pertencer ao role)
12. Auth: magic link only (Resend)
13. Histórico no perfil, manter look-and-feel do protótipo
14. Repos separados + pacote contracts
15. Abordagem de execução: Socket.IO + Prisma + @Cron + app-level broadcast (single-instance pronta pra escalar com Redis quando precisar)
