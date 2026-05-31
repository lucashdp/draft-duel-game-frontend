# Melhorias de interface — campeonatos, partida, draft e ao vivo

**Data:** 2026-05-31
**Autor:** Lucas (com Claude)
**Status:** Aprovado para planejamento

---

## Contexto

Conjunto de 10 melhorias de UI no jogo Draft Duel, abrangendo quatro telas: lista de
campeonatos (`/championships/[slug]`), detalhe da partida (`/matches/[id]`), e a sala
(`/rooms/[id]`) nas fases de draft e ao vivo. O grosso é frontend
(`draft-duel-game-frontend`), com três pequenas adições no backend (`draft-duel-game-api`)
que destravam dados que o frontend não tem hoje.

O trabalho roda em **worktrees isoladas** (o usuário tem outra frente ativa em
`fix/live-game-bugs`).

## Objetivos

Entregar as 10 melhorias listadas abaixo, mantendo os padrões do código existente
(Base UI + shadcn/ui, Tailwind v4, TanStack Query, contratos Zod em `src/lib/contracts`).

## Fora de escopo

- Redesign de telas não listadas (login, /me, lobby).
- Mudanças no motor de pontuação ou na lógica de draft/substituição do backend.
- Novos testes E2E (Playwright), salvo pedido posterior.

---

## Repositórios e worktrees

| Repo | Worktree | Branch | Conteúdo |
|------|----------|--------|----------|
| `draft-duel-game-frontend` | `.worktrees/live-ui-improvements` | `feat/live-ui-improvements` | Itens 1–10 (UI) |
| `draft-duel-game-api` | a criar (`.worktrees/match-events-and-room-dtos`) | `feat/match-events-and-room-dtos` | 3 adições de backend |

A worktree do frontend já existe. A do backend será criada no início da fase de backend.

---

## Mudanças no backend (`draft-duel-game-api`)

Três adições pequenas, todas no módulo `catalog`/`rooms`. Nenhuma altera regras de negócio.

### B1 — `GET /matches/:id/events` (destrava item 3)

- Novo endpoint no `catalog.controller.ts` (ou módulo de match), lendo `MatchEvent` por
  `matchId` (model já existe, indexado por `[matchId, minute]`).
- Resposta: array ordenado por `minute` (e `occurredAt`) de
  `{ id, athlete: { id, name, shortName, position, jerseyNumber, teamId }, action, minute, occurredAt }`.
- **Sem pontos** — pontuação (`points`) depende de `ScoringRule` por-sala e da role; o feed
  global da partida não carrega pontuação. A tela mostra ação + minuto + atleta + ícone.
- Excluir eventos cancelados, se o backend marcar cancelamento (verificar; `MatchEvent` no
  schema não tem flag `canceled` — o cancelamento vive em outro lugar; confirmar na
  implementação se há eventos a filtrar).
- Validação Zod + teste do controller/service.

### B2 — `imageUrl` no `teamRef` do snapshot da sala (destrava item 6)

- O DTO `teamRef` em `rooms` (usado em `roomSnapshotSchema.match.homeTeam/awayTeam`) hoje
  expõe `name, shortName, abbreviation, primaryColor, secondaryColor` mas **não** `imageUrl`.
- Adicionar `imageUrl: string | null` ao DTO de saída do backend e ao
  `teamRefSchema` no contrato do frontend (`src/lib/contracts/rooms.ts`).
- Sem isso, o frontend não tem o escudo no estado live sem uma query extra.

### B3 — `match.id` no resumo de `/me/rooms` (destrava item 4)

- `roomSummarySchema.match` hoje traz só `{ kickoffAt, status, homeTeam, awayTeam }` (sem id).
- Adicionar `id: string` ao `match` do resumo, no backend e no contrato do frontend.
- Permite filtrar `useMyRooms('active')` por `match.id === <partida atual>`.

---

## Primitivas compartilhadas (frontend)

### P1 — `src/lib/teamColors.ts` (itens 2 e 5)

Resolve a paleta de cada time de uma partida aplicando a regra de inversão quando as cores
predominantes colidem.

```
type Palette = { primary: string; secondary: string }

// distância perceptual entre duas cores hex (redmean); retorna número
colorDistance(a: string, b: string): number

// se as primárias forem muito próximas (distância < THRESHOLD), inverte
// primária<->secundária do time VISITANTE (away). Trata null com defaults neutros.
resolveMatchPalettes(
  home: { primaryColor: string | null; secondaryColor: string | null },
  away: { primaryColor: string | null; secondaryColor: string | null },
): { home: Palette; away: Palette }
```

- `THRESHOLD` constante e tunável (chute inicial ~40 numa escala redmean ~0–765); documentar.
- Defaults neutros reusam os de `PlayerCard` (`#1f2937` / `#ffffff`).
- Caso extremo: se mesmo após inverter a paleta do away continuar idêntica à do home
  (time com primária == secundária), aplicar um anel/outline sutil de distinção no badge do
  away. Tratar como fallback de baixa prioridade.
- Helper auxiliar para mapear um atleta à paleta certa:
  - Draft: `DraftPoolEntry.teamSide` (`'home' | 'away'`) → paleta resolvida.
  - Ao vivo: `athlete.teamId` comparado a `room.match.homeTeam.id` → home, senão away.

### P2 — `src/lib/actionIcons.tsx` (item 10)

- Mapa `ActionType → ícone` ao lado do `ACTION_LABELS` existente (usado em `MatchTimeline`).
- Cobrir os 21 `ACTION_TYPES`. Mistura aceitável de emoji (gol ⚽, cartões 🟨🟥) e ícones
  lucide para os demais (defesa, desarme, etc.); set final definido na implementação,
  priorizando legibilidade e consistência com o `Radio` já usado.
- Consumido pela timeline ao vivo (`MatchTimeline`) e pela timeline da tela de eventos (item 3).

---

## Design por item

### Item 1 — Lista de campeonatos: destaque do jogo ao vivo + tempo

- Arquivo: `src/components/MatchCard.tsx`.
- Para `match.status === 'live'`: ícone distinto pulsante (estilo `Radio`/ponto vermelho)
  diferenciando o card ao vivo dos demais, e o minuto (`match.currentMinute`, já no schema)
  em destaque junto ao placar. Hoje já mostra `${currentMinute}'` discreto — tornar evidente.
- Frontend-only (dado já disponível em `matchSummarySchema`).

### Item 2 — Detalhe da partida: inversão de cor do visitante

- Arquivos: `src/components/MatchCard.tsx` (`TeamBadge`/`TeamIcon`), via `resolveMatchPalettes`.
- Quando as primárias de casa e fora forem muito próximas (limiar), o quadradinho do time
  **de fora** usa cores invertidas (predominante vira secundária e vice-versa).
- `TeamIcon` passa a receber a paleta já resolvida (ou um flag de inversão).

### Item 3 — Detalhe da partida ao vivo/encerrada: eventos no lugar dos jogadores

- Arquivo: `src/app/matches/[id]/page.tsx`.
- Quando `status` for `live` ou `finished` (considerar o ajuste do MatchCard que confia no
  placar mesmo com status `scheduled` + placar): esconder `LineupGrid` ("Jogadores
  Disponíveis") e mostrar a timeline de eventos da partida.
- Novo hook `useMatchEvents(id)` (TanStack Query → `GET /matches/:id/events`, contrato Zod
  novo em `src/lib/contracts`).
- Componente de timeline compartilhado com o ao vivo (ver item 10) — mas aqui **sem pontos**
  (o endpoint não traz pontuação). Variante "modo partida" que omite a coluna de pontos.

### Item 4 — Detalhe da partida: voltar para a sala em andamento

- Arquivo: `src/app/matches/[id]/page.tsx`.
- Usar `useMyRooms('active')` (já existe) e, com o `match.id` agora disponível no resumo (B3),
  procurar uma sala ativa (`waiting | drafting | live`) **desta** partida.
- Se existir: trocar o botão "Criar sala" por "Voltar para a sala" (link para `/rooms/<id>`).
  Senão: comportamento atual.
- Só renderiza a verificação quando autenticado.

### Item 5 — Draft e ao vivo: cores dos atletas pela paleta do time

- Arquivos: `src/components/draft/DraftPool.tsx`, `src/components/draft/DraftBoard.tsx`
  (e `TeamLineup` do draft, se aplicável), `src/components/live/TeamLineup.tsx`,
  e o painel/modal de substituição.
- Remover os `#666`/`#fff` hardcoded; usar a paleta resolvida (P1) por atleta
  (via `teamSide` no draft, via `teamId` ao vivo).
- `JerseyIcon` continua igual; só recebe cores corretas.

### Item 6 — Ao vivo: escudos no placar da partida real

- Arquivo: `src/components/live/MatchHeader.tsx`.
- Mostrar escudo (`TeamIcon` com `imageUrl` de B2) ao lado de cada time no placar real.
- **Escudos vão no placar da partida real (MatchHeader), não nos cards de Você/Oponente** —
  cada jogador tem atletas dos dois times, então um escudo no card humano não faz sentido.
- `MatchHeader` passa a receber `imageUrl`/cores/abreviação dos times (hoje recebe só
  `{ id, name, shortName }`).

### Item 7 — Ao vivo desktop: novo layout (opção A)

- Arquivo: `src/app/(app)/rooms/[id]/live-match-view.tsx`.
- Trocar a grade `lg:grid-cols-[1fr_1fr_1.5fr]` por layout empilhado:
  - Linha 1: `MatchHeader` (com escudos).
  - Linha 2: `ScoreboardCards` (placar dos jogadores).
  - Linha 3: duas escalações **lado a lado e largas** (`lg:grid-cols-2`) — resolve nomes
    apertados/quebrando.
  - Linha 4: timeline de **eventos em largura total** abaixo (em 2 colunas no desktop).
- O painel lateral de substituição some daqui (vira modal — item 9).

### Item 8 — Ao vivo mobile: header enxuto

- Arquivo: `src/components/live/MatchHeader.tsx` (responsivo).
- Mobile: escudo + **abreviação** do time; manter o ícone de ao vivo (`Radio` pulsante)
  **sem o texto "AO VIVO"** (ocupa espaço e fica feio no mobile).
- Desktop: escudo + `shortName` + texto "AO VIVO".

### Item 9 — Substituição: modal guiada em 3 passos

- Arquivos: `src/app/(app)/rooms/[id]/live-match-view.tsx`, novo
  `src/components/live/SubstitutionModal.tsx`; aposentar/absorver `SubstitutionPanel.tsx` e
  `ConfirmSubDialog.tsx`; remover o `subMode` inline da escalação.
- Fluxo (Base UI `Dialog`):
  1. **Quem sai?** — lista a escalação do usuário; clicar destaca a linha.
  2. **Quem entra?** — pool filtrado pela posição de quem sai.
  3. **Confirmar** — mostra "sai → entra"; confirma.
- Navegação: stepper (1·2·3), "Próximo" explícito (não avança sozinho ao clicar),
  "Voltar" preserva escolhas, "Cancelar"/✕ fecha. "Confirmar" mostra loading e fecha ao
  concluir; erros viram toast (reusar `TOAST_BY_CODE` atual).
- O botão "Substituir" do `ScoreboardCards` passa a abrir a modal (em vez de alternar o
  modo inline).

### Item 10 — Ícones nos eventos

- Usar `P2 (actionIcons)` no `MatchTimeline` (ao vivo) e na timeline da tela de eventos (item 3).
- Cada linha de evento ganha o ícone do tipo de ação à esquerda do minuto/nome.

---

## Touchpoints de dados (resumo)

| Dado necessário | Existe hoje? | Ação |
|---|---|---|
| `currentMinute` na lista (item 1) | Sim (`matchSummarySchema`) | usar |
| eventos da partida (item 3) | Não | B1 + `useMatchEvents` |
| `match.id` no resumo de salas (item 4) | Não | B3 |
| `imageUrl` do time na sala (item 6) | Não | B2 |
| cores do time na sala (itens 5/6) | Sim (anuláveis) | tratar null |
| `teamId`/`teamSide` do atleta (item 5) | Sim (`athleteRefSchema`/pool) | usar |

---

## Estratégia de testes

- **Frontend (Vitest):**
  - ⚠️ Rodar com `vitest run --pool=threads` (o pool padrão de forks dá timeout por causa do
    espaço no path do repo — "Duel Game").
  - `teamColors`: limiar, inversão do away, tratamento de null, caso extremo.
  - `actionIcons`: mapa cobre todos os `ACTION_TYPES`.
  - `useMatchEvents`: parsing/fetch.
  - lookup de sala ativa por `match.id`.
  - Ajustar testes dos componentes tocados (`MatchCard`, `MatchHeader`, timeline, modal de sub).
- **Backend (Jest):** teste do endpoint `GET /matches/:id/events` (ordenação, formato, filtro
  de cancelados se aplicável).
- **TDD:** seguir red-green-refactor onde fizer sentido (helpers e hooks são bons candidatos).

---

## Ordem de execução sugerida

1. Backend (B1–B3) na worktree da API → frontend passa a ter os dados.
2. Primitivas (P1 `teamColors`, P2 `actionIcons`).
3. Itens por tela: 1 → 2 → 5 (dependem de P1) ; 6 → 8 (header) ; 7 (layout) ; 9 (modal) ;
   3 → 10 (eventos, dependem de B1/P2) ; 4 (depende de B3).

---

## Decisões registradas (brainstorming)

- **Item 2 "mesma cor":** limiar de similaridade perceptual (não só igualdade exata de hex).
- **Item 4 escopo:** só a sala da partida atual (substitui o botão "Criar sala").
- **Item 3:** fazer o endpoint de eventos no backend (frontend-only não tem fonte de dados).
- **Item 6:** escudos no placar da partida real (não nos cards humanos).
- **Item 7 layout desktop:** opção A (escalações largas em cima, eventos full-width embaixo).
- **Item 9 fluxo:** modal de 3 passos com "Próximo" explícito; "Voltar" preserva escolhas.
- **Item 10:** adicionado ao escopo (ícones por tipo de ação na(s) timeline(s)).
