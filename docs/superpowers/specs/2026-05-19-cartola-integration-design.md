# Integração Cartola FC — Design

**Data:** 2026-05-19
**Vertical:** Stats provider real para Brasileirão (sub-escopo: só calendário)
**Status:** spec aprovada, aguardando plano de implementação
**Spec mestre relacionada:** [`2026-05-01-draft-duel-rebuild-design.md`](./2026-05-01-draft-duel-rebuild-design.md) §3, §5.2, §8

---

## 1. Resumo

Substituir o `StubStatsProvider` por uma fonte real (API pública do Cartola FC da Globo) para o **Brasileirão**, mantendo o Stub para os campeonatos que ainda não têm vendor real (Copa do Mundo). Recorte mínimo: somente os métodos do `StatsProvider` relacionados a calendário — `fetchChampionships`, `fetchTeams`, `fetchRounds`, `fetchMatchesByRound`. Atletas e escalações por partida continuam stub até as próximas verticais (Draft e Partida ao vivo).

A integração não muda o contrato visto pelo frontend nem o `CatalogSyncService`. Cartola é consumido **apenas dentro dos workers cron**, populando o Postgres; a UI continua lendo só do nosso DB.

## 2. Decisões fixadas no brainstorm

| Tópico | Decisão | Motivo |
|---|---|---|
| Escopo | Só calendário: champs + rounds + matches (+ teams como dado de suporte para integridade FK). Sem athletes/lineups reais agora. | Recorte mínimo que entrega valor visível (jogos reais na home) sem depender de timing do mercado do Cartola para escalações. |
| Coexistência | Hybrid: Cartola para Brasileirão, Stub para Copa do Mundo. | Cartola só cobre Série A; Copa precisa de outro vendor (TBD). Compor é mais simples que esperar. |
| Imagens | Ignorar `imageUrl` do Cartola. UI continua usando `JerseyIcon` SVG. | Spec mestre fixou "sem direito de imagem oficial" (§2.5). Zero risco legal. |
| Frontend | Zero código novo. | Contrato REST da nossa API não muda. Eventual ajuste de Playwright fica como QA menor. |
| Cadência | Manter workers existentes (CatalogSyncWorker 1×/dia 05:00, CalendarSyncWorker 6h). | Já calibrado e suficiente; trocar cadência é vertical separada. |
| Cache | Fora de escopo. | Cadência baixa e payloads pequenos não justificam cache agora. |
| PR | Um PR só, no repo da API. | Frontend não muda. |

## 3. Arquitetura

A interface `StatsProvider` (existente) não muda. Adiciona-se um provider HTTP real (`CartolaStatsProvider`) e um composer (`HybridStatsProvider`) que roteia chamadas entre Cartola e Stub.

```
CalendarSyncWorker (6h)
    │
    ▼
CatalogSyncService.syncCalendar()  ── chama StatsProvider via DI
    │
    ▼
HybridStatsProvider                ── injetado quando STATS_PROVIDER_KIND='hybrid'
    │ routing por prefixo do externalId
    ├── 'cartola-*'  →  CartolaStatsProvider  →  HTTP api.cartola.globo.com
    └── 'stub-*'     →  StubStatsProvider     →  dados hardcoded
    │
    ▼
CatalogSyncService.upsert*()       ── persiste em championships/rounds/teams/matches
    │
    ▼
Postgres (fonte da verdade)
    ▲ leitura
CatalogService                     ── já existe, sem mudança
    │
    ▼
REST /championships, /matches/:id  ── consumido pelo frontend (sem mudança)
```

**Princípios preservados** (spec mestre §4.1):
- Postgres autoritativo: frontend nunca toca o Cartola.
- API stateless: provider escolhido no boot via env.
- StatsProvider abstrato: trocar fornecedor é trocar implementação.

### 3.1 Estrutura de arquivos (módulo `stats`)

```
src/modules/stats/
├── stats-provider.ts                       (existente, sem mudança)
├── stats.module.ts                         (factory atualizada)
├── stub-stats.provider.ts                  (existente)
├── stub-stats.provider.spec.ts             (existente)
├── cartola/                                ← NOVO
│   ├── cartola-stats.provider.ts
│   ├── cartola-stats.provider.spec.ts
│   ├── cartola-http.client.ts
│   ├── cartola-http.client.spec.ts
│   ├── cartola.mapper.ts
│   ├── cartola.mapper.spec.ts
│   ├── cartola.schemas.ts                  (Zod p/ validar responses)
│   ├── cartola.constants.ts                (URLs, IDs fixos, position map)
│   └── cartola.errors.ts                   (CartolaError + subclasses)
└── hybrid/                                 ← NOVO
    ├── hybrid-stats.provider.ts
    ├── hybrid-stats.provider.spec.ts
    └── hybrid.constants.ts                 (CARTOLA_PREFIX, STUB_PREFIX)
```

## 4. Endpoints Cartola e mapeamento para DTOs

### 4.1 Endpoints utilizados

| Endpoint | Frequência | Uso |
|---|---|---|
| `GET /mercado/status` | leitura barata | Descobre `rodada_atual`, `temporada` |
| `GET /rodadas` | 1×/dia | Lista das 38 rodadas da Série A |
| `GET /clubes` | 1×/dia | Clubes da temporada corrente |
| `GET /partidas` | a cada 6h | Partidas da **rodada atual** com `clubes` embed |
| `GET /partidas/{N}` | sob demanda | Partidas de uma rodada específica (backfill) |

> A API não oferece um endpoint único com toda a temporada. `CalendarSyncWorker` itera as rodadas devolvidas por `fetchRounds` e chama `fetchMatchesByRound` para cada uma. Em prática: ~40 chamadas HTTP por ciclo de sync (38 rodadas + 1 `/rodadas` + 1 `/clubes`), a cada 6h — tráfego desprezível, sem necessidade de cache.

### 4.2 Shapes conhecidos (validar com Zod no boot)

**`/mercado/status`** (resumido):
```json
{ "rodada_atual": 5, "temporada": 2026, "status_mercado": 2 }
```

**`/rodadas`** (array):
```json
[
  { "rodada_id": 1, "inicio": "2026-04-13 16:00:00", "fim": "2026-04-16 22:00:00", "nome": "Rodada 01" }
]
```

**`/clubes`** (objeto indexado por id):
```json
{
  "262": { "id": 262, "nome": "Flamengo", "abreviacao": "FLA", "apelido": "Mengão", "escudos": { "60x60": "...", "45x45": "...", "30x30": "..." } }
}
```

**`/partidas`** (envelope):
```json
{
  "rodada": 5,
  "partidas": [
    {
      "partida_id": 84203,
      "clube_casa_id": 262,
      "clube_visitante_id": 264,
      "partida_data": "2026-05-19 21:30:00",
      "timestamp": 1716060600,
      "placar_oficial_mandante": null,
      "placar_oficial_visitante": null,
      "periodo_tr": "PRE",
      "status_cronometro_tr": "Pré-jogo",
      "valida": true
    }
  ],
  "clubes": { "262": { /* ... */ }, "264": { /* ... */ } }
}
```

> Os shapes acima são baseados no formato conhecido da API pública do Cartola. Cada campo declarado em uso recebe schema Zod. Os schemas **não** usam `.strict()`, tolerando campos extras que o vendor venha a adicionar; campos ausentes ou com tipo errado, sim, falham — caem em `CartolaSchemaError`.

### 4.3 Convenção de `externalId`

Todo identificador devolvido pelo `CartolaStatsProvider` recebe prefixo `cartola-` — garante roteamento determinístico no `HybridStatsProvider` sem state nem DB lookup.

| Entidade | Formato | Exemplo |
|---|---|---|
| Championship | `cartola-brasileirao` | hardcoded (Cartola só tem 1) |
| Round | `cartola-rodada-{rodada_id}` | `cartola-rodada-12` |
| Team | `cartola-clube-{id}` | `cartola-clube-262` |
| Match | `cartola-partida-{partida_id}` | `cartola-partida-84203` |
| Athlete | `cartola-atleta-{atleta_id}` | reservado (não usa agora) |

### 4.4 Mapeamentos campo a campo

**Championship** (estático, sem chamada HTTP):
```ts
{
  externalId: 'cartola-brasileirao',
  slug: 'brasileirao',
  name: 'Brasileirão',
  kind: 'league',
}
```

**Team** (`/clubes` → `TeamDto`):

| DTO | Origem Cartola | Notas |
|---|---|---|
| `externalId` | `cartola-clube-${id}` | |
| `name` | `nome` | |
| `shortName` | `apelido ?? nome` | |
| `abbreviation` | `abreviacao` | |
| `imageUrl` | `null` | decisão de produto |
| `primaryColor` | `'#000000'` | placeholder; ajuste manual é TODO de backlog |
| `secondaryColor` | `'#FFFFFF'` | idem |

**Round** (`/rodadas` → `RoundDto`):

| DTO | Origem | Notas |
|---|---|---|
| `externalId` | `cartola-rodada-${rodada_id}` | |
| `number` | `rodada_id` | |
| `name` | `nome` | "Rodada 01" |
| `startsAt` | `inicio` | parse "YYYY-MM-DD HH:mm:ss" como `America/Sao_Paulo` → ISO UTC |
| `endsAt` | `fim` | idem |

**Match** (`/partidas` → `MatchDto`):

| DTO | Origem | Notas |
|---|---|---|
| `externalId` | `cartola-partida-${partida_id}` | |
| `championshipExternalId` | `'cartola-brasileirao'` | fixo |
| `roundExternalId` | `cartola-rodada-${rodada}` | da resposta envelope |
| `homeTeamExternalId` | `cartola-clube-${clube_casa_id}` | |
| `awayTeamExternalId` | `cartola-clube-${clube_visitante_id}` | |
| `kickoffAt` | `partida_data` parseado em `America/Sao_Paulo` → UTC | preferir esse a `timestamp` (mais transparente em logs) |
| `status` | `mapMatchStatus(partida)` (abaixo) | |

**`mapMatchStatus(partida): MatchStatusDto`** — derivada porque Cartola não tem campo único de status:

```
if (partida.valida === false)                                   → 'postponed'
else if (placar_oficial_mandante !== null
         && placar_oficial_visitante !== null)                  → 'finished'
else if (periodo_tr && periodo_tr !== 'PRE' && periodo_tr !== 'POS')
                                                                 → 'live'
else                                                             → 'scheduled'
```

**Position mapping** (reservado para vertical Draft):

```
1 → GOL, 2 → LAT, 3 → ZAG, 4 → MEI, 5 → ATA, 6 → (skip — técnico)
```

### 4.5 Comportamento de cada método do `CartolaStatsProvider`

| Método | Comportamento |
|---|---|
| `fetchChampionships()` | Retorna `[ { Brasileirão } ]` hardcoded (zero HTTP) |
| `fetchTeams(extId)` | Aceita só `cartola-brasileirao` → `GET /clubes` → mapeia |
| `fetchAthletes(_)` | Retorna `[]` (vertical Draft) |
| `fetchRounds(extId)` | Aceita só `cartola-brasileirao` → `GET /rodadas` → mapeia |
| `fetchMatchesByRound(champ, round)` | Extrai N de `cartola-rodada-N` → `GET /partidas/{N}`. Se N === rodada atual, opcionalmente usa `GET /partidas` (envelope mais rico) |
| `fetchMatchLineups(_)` | Retorna `null` (vertical Draft) |

Chamadas com `extId` que não comecem com `cartola-` lançam `Error('CartolaStatsProvider: external id sem prefixo cartola-')`. O composer (`HybridStatsProvider`) impede que isso aconteça em runtime; a defesa é contra mau uso direto.

## 5. HybridStatsProvider

### 5.1 Roteamento por prefixo

```ts
@Injectable()
export class HybridStatsProvider implements StatsProvider {
  constructor(
    private readonly cartola: CartolaStatsProvider,
    private readonly stub: StubStatsProvider,
  ) {}

  async fetchChampionships(): Promise<ChampionshipDto[]> {
    let cartola: ChampionshipDto[] = [];
    try {
      cartola = await this.cartola.fetchChampionships();
    } catch (err) {
      this.logger.warn({ event: 'hybrid.cartola_unavailable', err: String(err) });
    }
    const stub = await this.stub.fetchChampionships();
    return [...cartola, ...stub.filter((x) => x.slug !== 'brasileirao')];
  }

  fetchTeams(extId: string)            { return this.pick(extId).fetchTeams(extId); }
  fetchAthletes(extId: string)         { return this.pick(extId).fetchAthletes(extId); }
  fetchRounds(extId: string)           { return this.pick(extId).fetchRounds(extId); }
  fetchMatchLineups(matchExtId: string){ return this.pick(matchExtId).fetchMatchLineups(matchExtId); }

  fetchMatchesByRound(champExtId: string, roundExtId: string) {
    return this.pick(champExtId).fetchMatchesByRound(champExtId, roundExtId);
  }

  private pick(extId: string): StatsProvider {
    return extId.startsWith(CARTOLA_PREFIX) ? this.cartola : this.stub;
  }
}
```

`CARTOLA_PREFIX = 'cartola-'` e `STUB_PREFIX = 'stub-'` em `hybrid/hybrid.constants.ts`.

### 5.2 StatsModule — factory atualizada

```ts
@Module({
  providers: [
    StubStatsProvider,
    CartolaHttpClient,
    CartolaStatsProvider,
    HybridStatsProvider,
    {
      provide: STATS_PROVIDER,
      inject: [ConfigService, StubStatsProvider, HybridStatsProvider],
      useFactory: (
        config: ConfigService<Config, true>,
        stub: StubStatsProvider,
        hybrid: HybridStatsProvider,
      ) => {
        const kind = config.get('STATS_PROVIDER_KIND', { infer: true });
        if (kind === 'stub') return stub;
        if (kind === 'hybrid') return hybrid;
        throw new Error(`Unknown STATS_PROVIDER_KIND: ${kind}`);
      },
    },
  ],
  exports: [STATS_PROVIDER],
})
export class StatsModule {}
```

## 6. Configuração

### 6.1 Env vars (mudanças em `config.schema.ts`)

| Variável | Tipo | Default | Notas |
|---|---|---|---|
| `STATS_PROVIDER_KIND` | `'stub' \| 'hybrid'` | `'stub'` | era apenas `'stub'` |
| `CARTOLA_BASE_URL` | url | `https://api.cartola.globo.com` | override para teste |
| `CARTOLA_REQUEST_TIMEOUT_MS` | int | `5000` | timeout por chamada HTTP |
| `CARTOLA_USER_AGENT` | string | `DraftDuel/1.0 (+contato)` | alguns CDNs do Globo bloqueiam UA padrão de bot |

`superRefine` no schema: quando `STATS_PROVIDER_KIND='hybrid'`, exigir presença das variáveis `CARTOLA_*` (com defaults garantem que isso sempre passa, mas a regra documenta a dependência).

`.env.example` ganha as 4 entradas comentadas com explicação curta.

### 6.2 Compatibilidade com `BootstrapService`

`BootstrapService` (fire-and-forget no boot) chama `syncCatalog()` + `syncCalendar()`. Com `STATS_PROVIDER_KIND='hybrid'`:

- Em dev sem internet → Cartola falha → loga warning → Stub serve Copa normalmente.
- Em CI → CI usa `STATS_PROVIDER_KIND='stub'` (default), Cartola nem é chamado → testes determinísticos preservados.

Sem mudança no `BootstrapService` em si.

## 7. CartolaHttpClient

Classe injetável, fina, responsabilidade única: HTTP. Mapeia erros, aplica timeout, valida resposta com Zod, loga.

```ts
@Injectable()
export class CartolaHttpClient {
  private readonly logger = new Logger(CartolaHttpClient.name);

  constructor(@Inject(...) private readonly config: ...) {}

  async get<T>(path: string, schema: ZodSchema<T>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': this.userAgent, 'Accept': 'application/json' },
      });
      if (!res.ok) throw new CartolaHttpError(res.status, path);
      const json = await res.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new CartolaSchemaError(path, parsed.error.issues);
      this.logger.log({ event: 'cartola.fetch.ok', path, status: res.status, durationMs: Date.now() - startedAt });
      return parsed.data;
    } catch (err) {
      this.logger.warn({ event: 'cartola.fetch.fail', path, durationMs: Date.now() - startedAt, err: String(err) });
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

**Sem retry interno.** Os workers (cron a cada 6h/1×dia) já são o retry natural. Se uma chamada falhar, o sync registra warning e o próximo ciclo refaz.

## 8. Erros, resiliência e telemetria

### 8.1 Hierarquia de erros

```ts
// cartola/cartola.errors.ts
export class CartolaError extends Error {}

export class CartolaHttpError extends CartolaError {
  constructor(public readonly status: number, public readonly path: string) {
    super(`Cartola ${path} returned HTTP ${status}`);
  }
}

export class CartolaTimeoutError extends CartolaError {
  constructor(public readonly path: string) {
    super(`Cartola ${path} timed out`);
  }
}
// Convertido no client: AbortController.abort() → AbortError → CartolaTimeoutError.

export class CartolaSchemaError extends CartolaError {
  constructor(public readonly path: string, public readonly issues: ZodIssue[]) {
    super(`Cartola ${path} response failed schema validation`);
  }
}
```

### 8.2 Política de falha por camada

| Camada | Comportamento em erro |
|---|---|
| `CartolaHttpClient` | Loga `cartola.fetch.fail`, propaga |
| `CartolaStatsProvider` | Propaga — não silencia |
| `HybridStatsProvider.fetchChampionships` | Se Cartola falha, retorna só os do Stub filtrados + loga `hybrid.cartola_unavailable`. Copa do Mundo continua funcionando |
| `HybridStatsProvider` outros métodos | Propaga — falha individual não tem fallback semântico |
| `CatalogSyncService` | Já trata: continua com próxima entidade, loga warning, não derruba o worker |
| `CalendarSyncWorker` / `CatalogSyncWorker` | Próximo ciclo (6h/1d) é o retry natural |

`fetchChampionships` é o único método com degradação parcial porque é onde a UI mais sente — sem ele, a home fica vazia. Para os demais (`fetchTeams/Rounds/Matches`), a próxima rodada do worker resolve.

### 8.3 Telemetria (logs Pino estruturados)

| Evento | Quando | Payload |
|---|---|---|
| `cartola.fetch.ok` | toda chamada bem-sucedida | `{ path, status, durationMs }` |
| `cartola.fetch.fail` | qualquer falha HTTP/timeout/schema | `{ path, durationMs, err }` |
| `hybrid.cartola_unavailable` | fallback ativado em `fetchChampionships` | `{ err, fallbackCount }` |
| `catalog.sync.started` / `.completed` / `.failed` | já existem | sem mudança |

Sem dashboard novo. Sentry/observabilidade avançada continua fora do MVP (spec mestre §3).

## 9. Migração do DB

**Problema:** se algum DB tem `Championship { slug:'brasileirao', externalId:'stub-br' }` populado pelo `BootstrapService` em runs anteriores, ao subir com `STATS_PROVIDER_KIND='hybrid'`:

- Cartola devolve `Championship { slug:'brasileirao', externalId:'cartola-brasileirao' }`.
- `upsertChampionship` busca por `externalId` → não encontra → tenta criar → falha por `slug @unique`.

**Solução: migration SQL idempotente** em `prisma/migrations/<ts>_cartola_replace_stub_brasileirao/migration.sql`:

```sql
DELETE FROM match_lineups WHERE match_id IN
  (SELECT id FROM matches WHERE championship_id IN
    (SELECT id FROM championships WHERE external_id = 'stub-br'));

DELETE FROM match_events WHERE match_id IN
  (SELECT id FROM matches WHERE championship_id IN
    (SELECT id FROM championships WHERE external_id = 'stub-br'));

DELETE FROM matches WHERE championship_id IN
  (SELECT id FROM championships WHERE external_id = 'stub-br');

DELETE FROM rounds WHERE championship_id IN
  (SELECT id FROM championships WHERE external_id = 'stub-br');

DELETE FROM championships WHERE external_id = 'stub-br';
```

**Notas:**

- Idempotente: roda em DB vazio sem efeito.
- Times e atletas com prefixo `stub-t-` ficam — podem estar referenciados por Copa. São namespaced por `externalId` e não interferem no hybrid.
- Pra dev: `npm run db:migrate:dev` aplica tudo automaticamente. `npm run db:migrate:reset` continua como opção de fresh start.
- Pra prod: ainda não existe; a migration roda no primeiro deploy hybrid sem incidente.

## 10. Testes

### 10.1 Unit (Jest + mocks)

| Spec | Cobertura |
|---|---|
| `cartola-http.client.spec.ts` | Timeout dispara; 5xx vira `CartolaHttpError`; resposta inválida vira `CartolaSchemaError`; happy path retorna dado validado; `User-Agent` é enviado |
| `cartola.mapper.spec.ts` | Cada mapper isolado: clube → `TeamDto`, partida → `MatchDto`, rodada → `RoundDto`. Edge cases: `apelido` ausente, `placar_oficial_*` null, `periodo_tr` em cada estado de status |
| `cartola-stats.provider.spec.ts` | Cada um dos 6 métodos com `CartolaHttpClient` mockado. `fetchAthletes` retorna `[]`. `fetchMatchLineups` retorna `null`. `fetchMatchesByRound` extrai N corretamente do externalId |
| `hybrid-stats.provider.spec.ts` | Roteamento por prefixo (positivo/negativo); `fetchChampionships` filtra Brasileirão do Stub; fallback ativado quando Cartola lança em `fetchChampionships` |

### 10.2 Integration (Jest + DB real)

| Spec | Cobertura |
|---|---|
| `catalog-sync.service.integration.spec.ts` (existente, **estender**) | Rodar `syncCalendar` com `HybridStatsProvider` injetado e `CartolaHttpClient` stubbed por fixture JSON → assert: 1 championship Brasileirão (cartola) + Copa (stub), rounds/teams/matches persistidos com `externalId` prefixado corretamente |

### 10.3 E2E

CI continua com `STATS_PROVIDER_KIND='stub'`. Zero teste de rede contra `api.cartola.globo.com` no pipeline.

Para testar manualmente contra Cartola real:
1. `STATS_PROVIDER_KIND=hybrid` no `.env`
2. `npm run start:dev`
3. Esperar primeiro ciclo de sync (ou rodar manualmente via método público)
4. Verificar via `GET /championships` e `GET /championships/brasileirao/current-round`

### 10.4 Frontend

Auditar antes:

| Teste | Risco |
|---|---|
| `test/e2e/home.spec.ts` (Playwright) | Assume label "Brasileirão" — Cartola devolve mesmo nome → **OK** |
| Outros Playwright de catálogo | Assumem times stub ("Flamengo×Palmeiras"). CI roda com Stub default → **OK** |
| Unit tests | Não dependem de provider concreto |

Conclusão: zero código frontend novo, zero spec frontend novo.

## 11. Documentação

| Arquivo | Mudança |
|---|---|
| `README.md` (API) | Nova seção "Stats providers" com tabela stub/hybrid + env vars |
| `.env.example` | 4 entradas novas (com defaults e comentários) |
| `docs/cartola-integration.md` (novo) | Endpoints usados, mapeamento de IDs, como testar local, troubleshooting (Cartola fora do ar, schema drift) |
| Spec mestre `2026-05-01-draft-duel-rebuild-design.md` | Nota curta na §8: "Vendor real escolhido: Cartola FC para Brasileirão MVP; vendor da Copa TBD" |

## 12. Packaging

**Branch:** `feat/cartola-stats-provider`
**Repos afetados:** somente API.

Arquivos:

| Mudança | Tipo |
|---|---|
| `src/modules/stats/cartola/*` | Novo |
| `src/modules/stats/hybrid/*` | Novo |
| `src/modules/stats/stats.module.ts` | Edit (factory) |
| `src/common/config/config.schema.ts` | Edit (4 vars) |
| `prisma/migrations/<ts>_cartola_replace_stub_brasileirao/migration.sql` | Novo |
| `.env.example` | Edit |
| `README.md` + `docs/cartola-integration.md` | Edit / novo |
| Specs unit + integration | Novo |

CI continua verde com `STATS_PROVIDER_KIND='stub'` default.

## 13. Rollout

1. PR merged em `main`.
2. Em dev local: trocar `.env` para `STATS_PROVIDER_KIND=hybrid`.
3. `npm run db:migrate:dev` (aplica migration de cleanup).
4. `npm run start:dev` → `BootstrapService` chama Cartola → home mostra partidas reais.
5. Validar visualmente `/championships` e `/championships/brasileirao/current-round`.
6. Staging/prod: atualizar env quando esses ambientes existirem.

## 14. Definition of Done

- [ ] `STATS_PROVIDER_KIND='hybrid'` faz boot sem erro, com ou sem internet (Cartola down → degrade para Copa-only)
- [ ] `GET /championships` lista Brasileirão (cartola) + Copa do Mundo (stub)
- [ ] `GET /championships/brasileirao/current-round` retorna rodada atual real com partidas reais
- [ ] `GET /matches/:id` funciona para partida real do Cartola
- [ ] Workers (`CalendarSyncWorker`, `CatalogSyncWorker`) executam sem erro contra Cartola
- [ ] Unit + integration verdes; lint verde; CI verde com Stub default
- [ ] `docs/cartola-integration.md` publicado
- [ ] `.env.example` e `README.md` atualizados

## 15. Fora de escopo (verticais futuras)

- `fetchAthletes` real via `/atletas/mercado` (vertical Draft)
- `fetchMatchLineups` real (vertical Draft)
- `LiveMatchPoller` consumindo `/atletas/pontuados/{rodada}` (vertical Partida ao vivo)
- Cores reais dos clubes (entra como vertical técnica menor; tabela de override)
- Cache HTTP / circuit breaker (se Cartola começar a rate-limit)
- Vendor real para Copa do Mundo (vertical específica, TBD)
- Métricas e dashboards (Sentry/observabilidade — spec mestre §3)
