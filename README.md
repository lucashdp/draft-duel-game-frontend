# draft-duel-game-frontend

Frontend do **Draft Duel** — jogo de draft snake 1v1 baseado em partidas ao vivo de futebol (Brasileirão e Copa do Mundo 2026).

> **Spec de produto e arquitetura:** [`docs/superpowers/specs/2026-05-01-draft-duel-rebuild-design.md`](docs/superpowers/specs/2026-05-01-draft-duel-rebuild-design.md)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Estilos | Dark theme via CSS custom properties + `@theme inline` |
| Estado servidor | TanStack Query v5 |
| Real-time | Socket.IO client v4 |
| Animações | Framer Motion |
| Validação | Zod v4 |
| Testes unitários | Vitest + Testing Library |
| Testes E2E | Playwright (chromium) |
| Fonte | Roboto Flex (via `next/font/google`) |

---

## O que está implementado (scaffold)

### Estrutura de rotas

```
/                          → home pública (seleção de campeonato)
/login                     → input de email (magic link)
/verify                    → consumo do token ?token=
/championships/[slug]      → partidas da rodada atual
/matches/[id]              → detalhe da partida
/rooms/[id]                → sala de draft + partida ao vivo
/me                        → perfil e histórico de salas
```

- Rotas em `(auth)/` usam layout centrado (max-w-sm)
- Rotas em `(app)/` têm guard de autenticação: redireciona para `/login` se `GET /me` retornar null

### Design system

`src/app/globals.css` define o tema dark completo via CSS custom properties + Tailwind v4 `@theme inline`:

| Token | Valor | Classe Tailwind |
|---|---|---|
| Background | `220 18% 8%` | `bg-background` |
| Primary (verde) | `140 70% 50%` | `bg-primary`, `text-primary` |
| Surface (cards) | `220 18% 11%` | `bg-surface` |
| Event positivo | `140 70% 50%` | `text-event-positive` |
| Event negativo | `0 80% 60%` | `text-event-negative` |
| Animações | flash-positive, flash-negative, pulse-sub | `animate-flash-positive`, etc. |

### Camada utilitária (`src/lib/`)

| Arquivo | Responsabilidade |
|---|---|
| `env.ts` | Zod schema de env vars (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`) |
| `api.ts` | Fetch wrapper com `credentials: 'include'`, `Content-Type: application/json`, `ApiError` |
| `socket.ts` | Singleton Socket.IO com `withCredentials: true`, `autoConnect: false` |
| `auth.ts` | Helper `getLoginPath(callbackPath?)` |

### Hooks (`src/hooks/`)

| Hook | Descrição |
|---|---|
| `useAuth()` | `useQuery` em `GET /me` → `{ user, isLoading }`. Auth via cookie httpOnly — sem decodificação de JWT no cliente |
| `useInvalidateAuth()` | Invalida cache do `['me']` após login/logout |
| `useSocket()` | Conecta Socket.IO no mount, desconecta no unmount |
| `useRoom()` | Stub — implementado no plano de features da sala |

### Componentes

| Componente | Descrição |
|---|---|
| `JerseyIcon` | Badge de camisa colorida com número do atleta. Props: `jerseyNumber`, `primaryColor`, `secondaryColor`, `size` (sm/md/lg) |
| `PlayerCard` | Linha de atleta com posição, jersey, nome e pontuação. Suporta `isSelected`, `isRemoved`, `flashType`, `compact` |
| `src/components/ui/` | shadcn/ui: button, input, label, badge, separator, dialog, sonner |

### Tipos de domínio (`src/types/domain.ts`)

`Position`, `ActionType`, `RoomStatus`, `Role`, `Winner`, `User`, `Championship`, `Team`, `Athlete`, `Match`, `DraftPick`, `LineupInterval`, `Room`, `MatchEvent`, `ACTION_LABELS`, `POSITION_ORDER`

> Estes tipos serão migrados para o pacote `@draft-duel/contracts` quando a estratégia de distribuição for definida (ver spec §10.3).

---

## Começando

```bash
# 1. Copiar variáveis de ambiente
cp .env.local.example .env.local

# 2. Instalar dependências
npm install

# 3. Subir servidor de desenvolvimento
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL base da API REST |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3001` | URL do servidor WebSocket |

---

## Testes

```bash
# Unitários (Vitest + Testing Library)
npm test

# Watch mode
npm run test:watch

# E2E (Playwright — inicia o dev server automaticamente)
npm run test:e2e
```

Cobertura atual:
- `test/unit/JerseyIcon.test.tsx` — 3 testes unitários (renders number, renders ?, size classes)
- `test/e2e/home.spec.ts` — 2 smoke tests (home heading, login heading)

---

## Próximos passos

Os shells de rota estão prontos. As features a implementar, em ordem:

1. **Auth flow** — formulário de magic link em `/login`, verificação em `/verify`, refresh de token
2. **Catálogo** — listagem de campeonatos na home, rodada atual + partidas em `/championships/[slug]`
3. **Criação de sala** — formulário em `/matches/[id]`, entrada via código
4. **Draft** — `useRoom` completo, `DraftBoard`, snake pick com Socket.IO
5. **Partida ao vivo** — `MatchScoreboard`, `MatchTimeline`, `SubstitutionDialog`
6. **Perfil** — histórico de salas em `/me`

---

## Estrutura de diretórios

```
src/
├── app/
│   ├── globals.css                   # dark theme + Tailwind v4 tokens
│   ├── layout.tsx                    # root: Roboto Flex + Providers
│   ├── page.tsx                      # home (pública)
│   ├── (auth)/
│   │   ├── layout.tsx                # layout centrado
│   │   ├── login/page.tsx
│   │   └── verify/page.tsx
│   └── (app)/
│       ├── layout.tsx                # auth guard
│       ├── championships/[slug]/page.tsx
│       ├── matches/[id]/page.tsx
│       ├── rooms/[id]/page.tsx
│       └── me/page.tsx
├── components/
│   ├── JerseyIcon.tsx
│   ├── PlayerCard.tsx
│   └── ui/                           # shadcn/ui
├── hooks/
│   ├── useAuth.ts
│   ├── useSocket.ts
│   └── useRoom.ts                    # stub
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   ├── env.ts
│   └── socket.ts
├── providers/
│   └── index.tsx                     # QueryClientProvider + Toaster
└── types/
    └── domain.ts                     # tipos compartilhados

test/
├── unit/
│   └── JerseyIcon.test.tsx
└── e2e/
    └── home.spec.ts
```
