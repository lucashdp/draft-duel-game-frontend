# Team Icon: exibir escudo do time

**Data:** 2026-05-30

## Contexto

O `TeamDto` já carrega `imageUrl: string | null` desde a origem (API do catálogo), mas nenhum componente de UI a utiliza. Em vez disso, todos os lugares que identificam um time visualmente exibem um quadrado colorido com `primaryColor`/`secondaryColor`. O objetivo é substituir esse quadrado pelo escudo real do time onde o **nome do time** aparece na tela.

## Escopo

| Componente | Local | Tamanho atual |
|---|---|---|
| `LineupGrid` → `TeamColumn` header | Header de cada coluna da escalação em `/matches/:id` | `w-6 h-6` |
| `MatchCard` → `TeamBadge` | Badge de time no card de partida | `w-8 h-8` |

Fora do escopo: `PlayerCard` / `JerseyIcon` (identificam jogadores individuais, não times).

## Componente: `TeamIcon`

**Arquivo:** `src/components/TeamIcon.tsx`

### Props

```ts
interface TeamIconProps {
  imageUrl: string | null
  primaryColor: string
  secondaryColor: string
  size?: 'sm' | 'md'
}
```

### Comportamento

- **`imageUrl` presente:** renderiza `<img src={imageUrl} alt="" />` com `object-contain` dentro de um container quadrado arredondado (`rounded`). Fundo escuro neutro para escudos com transparência.
- **`imageUrl` null:** fallback para o quadrado de cor atual — `backgroundColor: primaryColor`, `border: secondaryColor` — mantendo o visual existente.
- `sm` = `w-6 h-6` | `md` = `w-8 h-8`

### Posicionamento home/away

O `MatchCard` já lida com posicionamento via prop `align: 'left' | 'right'` (flex-row vs flex-row-reverse). Nenhuma mudança necessária — `TeamIcon` é só o elemento visual, não carrega lógica de layout.

## Callers

### `LineupGrid.tsx`

```tsx
// antes
<div className="w-6 h-6 rounded shrink-0" style={{ backgroundColor: team.primaryColor, border: `1px solid ${team.secondaryColor}33` }} />

// depois
<TeamIcon size="sm" imageUrl={team.imageUrl} primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} />
```

### `MatchCard.tsx`

```tsx
// antes
<div className="w-8 h-8 rounded shrink-0" style={{ backgroundColor: team.primaryColor, border: `2px solid ${team.secondaryColor}` }} />

// depois
<TeamIcon size="md" imageUrl={team.imageUrl} primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} />
```

## Testes

- `TeamIcon.test.tsx`: renderiza `<img>` quando `imageUrl` é fornecida; renderiza div de cor quando `imageUrl` é null.
- `LineupGrid.test.tsx`: existente passa sem alteração (dados de teste têm `imageUrl: null`, fallback de cor mantém visual).
- `MatchCard.test.tsx`: idem — existente passa sem alteração.

## Compatibilidade

Todos os callers existentes de `PlayerCard` e `JerseyIcon` ficam intactos. `JerseyIcon` não é modificado.
