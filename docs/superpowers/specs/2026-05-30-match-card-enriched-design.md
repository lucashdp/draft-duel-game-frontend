# Match Card Enriched — Design Spec

**Data:** 2026-05-30  
**Status:** Aprovado

---

## Contexto

A listagem de partidas (`/championships/[slug]`) exibe cards compactos com times e horário/placar. O objetivo é enriquecer esses cards com informações de contexto para cada partida: histórico de forma dos times, colocação na tabela, estádio e data do jogo.

---

## Decisões de design

### Layout do card (Layout B)

Cada card usa um grid de três colunas:

```
[col esquerda]           [centro]          [col direita]
 ⚽ Flamengo              21:00            Palmeiras ⚽
 🏆 1º lugar            🏟️ Maracanã        3º lugar 🏆
 🟩🟩🟨🟥🟩                               🟩🟥🟩🟨🟩
```

- **Colunas dos times:** ícone + nome + colocação (com ícone de troféu) + 5 badges de forma (V/E/D)
- **Centro:** hora de kickoff (partidas agendadas) ou placar (live/encerradas) + nome do estádio abaixo
- **A data não aparece no card** — ela fica no header do grupo de partidas na página

### Forma dos times

Badges coloridos: `V` = verde (#22c55e), `E` = amarelo (#eab308), `D` = vermelho (#ef4444).  
Array ordenado do mais antigo para o mais recente (o jogo mais recente fica na direita).

### Colocação

Exibida como `"🏆 Nº lugar"` abaixo do nome do time. Quando `position === null` (copas sem tabela), a linha não é renderizada.

### Agrupamento por dia na página

A listagem passa a mostrar **todas as partidas da rodada** (incluindo encerradas — exibem placar final), agrupadas por dia de `kickoffAt`. Cada grupo tem um header com a data por extenso (ex: "Sábado, 31 de maio").

---

## Contrato de dados

### Novo tipo: `MatchTeamSummaryDto`

Estende `TeamDto` com campos de contexto da temporada. Adicionado em `src/lib/contracts/catalog.ts`:

```typescript
export const matchTeamSummarySchema = teamSchema.extend({
  position: z.number().nullable(),
  form: z.array(z.enum(['V', 'E', 'D'])),
})
export type MatchTeamSummaryDto = z.infer<typeof matchTeamSummarySchema>
```

### Mudanças em `matchSummarySchema`

- `homeTeam` e `awayTeam` passam de `teamSchema` para `matchTeamSummarySchema`
- Adicionado `venue: z.string().nullable()`

`TeamDto` e `teamSchema` não mudam — continuam sendo usados em `AthleteDto` e outros contextos onde posição/forma não se aplicam.

---

## Componentes afetados

### `src/components/MatchCard.tsx`

- `TeamBadge` recebe `team: MatchTeamSummaryDto` e renderiza: ícone + nome + colocação + badges de forma
- Centro adiciona `venue` abaixo do horário/placar
- Colocação e forma não renderizam quando `null` / array vazio
- `MatchCardProps` continua aceitando `match: MatchSummaryDto` — sem mudança de interface pública

### `src/app/championships/[slug]/page.tsx`

- Remove o filtro que descartava partidas `finished`, `postponed` e `canceled`
- Agrupa `data.matches` por dia (`kickoffAt`) antes de renderizar
- Extrai componente local `DateGroup` (section + h2 de data + lista de cards)
- Ordenação: dias em ordem crescente, partidas dentro do dia em ordem crescente de `kickoffAt`

### `src/hooks/useCatalog.ts`

Sem mudanças — o hook já retorna todas as partidas; o filtro era client-side.

---

## Casos de borda

| Situação | Comportamento |
|---|---|
| `position === null` | Linha de colocação não renderiza |
| `form.length === 0` | Linha de badges não renderiza |
| `venue === null` | Nome do estádio não renderiza |
| Partida adiada/cancelada | Exibe status (`Adiado` / `Cancelado`) no lugar do horário |
| Jogo ao vivo | Placar + minuto atual em verde no centro |

---

## Fora de escopo

- Mudanças no endpoint do backend (responsabilidade da API)
- Tela de detalhe da partida (`/matches/[id]`)
- Outros usos de `MatchCard` (ex: `matches/[id]/page.tsx`)
