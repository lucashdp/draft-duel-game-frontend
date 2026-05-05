# Draft Duel Frontend — Initial Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js 15 App Router project with the complete directory structure, dark design system, all route shells, providers, and utility layer (API client, auth, Socket.IO) needed to start implementing features.

**Architecture:** Route groups: `(auth)` for public pages, `(app)` for protected pages. Server components by default; `"use client"` only where interactivity requires it. All real-time state arrives via Socket.IO events; server data via TanStack Query. Auth state derives from `GET /me` because all cookies are httpOnly — the frontend never decodes JWTs.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 3, shadcn/ui, TanStack Query v5, Framer Motion, Socket.IO client v4, Zod v3, Vitest, Playwright.

---

## File Map

```
src/
├── app/
│   ├── globals.css                          # dark theme CSS variables + animations
│   ├── layout.tsx                           # root layout: Roboto Flex font, <Providers>
│   ├── page.tsx                             # home shell (championship selection)
│   ├── (auth)/
│   │   ├── layout.tsx                       # centered card wrapper
│   │   ├── login/page.tsx                   # email input shell
│   │   └── verify/page.tsx                  # token verification shell
│   └── (app)/
│       ├── layout.tsx                       # auth guard (redirects to /login if unauthenticated)
│       ├── championships/[slug]/page.tsx    # championship shell
│       ├── matches/[id]/page.tsx            # match shell
│       ├── rooms/[id]/page.tsx              # room/draft/live shell
│       └── me/page.tsx                      # profile shell
├── components/
│   ├── JerseyIcon.tsx                       # colored jersey badge with jersey number
│   ├── PlayerCard.tsx                       # athlete row card with score + flash animations
│   └── ui/                                  # shadcn/ui generated components
├── hooks/
│   ├── useAuth.ts                           # React Query wrapper for GET /me
│   ├── useSocket.ts                         # Socket.IO connection lifecycle hook
│   └── useRoom.ts                           # stub — full impl in room feature plan
├── lib/
│   ├── api.ts                               # fetch wrapper: credentials, error class
│   ├── auth.ts                              # redirect path helpers
│   ├── env.ts                               # Zod-validated env vars
│   ├── socket.ts                            # Socket.IO singleton factory
│   └── utils.ts                             # shadcn cn() utility (generated)
├── providers/
│   └── index.tsx                            # QueryClientProvider + Toaster
└── types/
    └── domain.ts                            # shared domain types (Position, Athlete, Match, …)

test/
├── unit/
│   └── JerseyIcon.test.tsx
└── e2e/
    └── home.spec.ts

tailwind.config.ts                           # custom tokens + animations
vitest.config.ts
playwright.config.ts
.env.local.example
```

---

## Task 1: Initialize Next.js 15 project

**Files:**
- Create: all Next.js scaffold files in `/workspace/repositories/draft-duel-game-frontend/`

- [ ] **Step 1: Run create-next-app into the existing repo directory**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx create-next-app@15 . \
  --typescript \
  --eslint \
  --tailwind \
  --src-dir \
  --app \
  --import-alias "@/*" \
  --use-npm \
  --yes
```

Expected: scaffold created. It will overwrite `README.md` (acceptable). `docs/` is untouched.

- [ ] **Step 2: Verify dev server starts**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200`. Then stop the server with `kill %1`.

- [ ] **Step 3: Commit baseline**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add -A
git commit -m "chore: init Next.js 15 App Router scaffold"
```

---

## Task 2: Tailwind v3 dark theme

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Verify Tailwind v3 is installed (not v4)**

```bash
cd /workspace/repositories/draft-duel-game-frontend
node -e "console.log(require('./node_modules/tailwindcss/package.json').version)"
```

Expected: version starting with `3.`. If it starts with `4.`, install v3:
```bash
npm install tailwindcss@^3.4 postcss autoprefixer --save-dev
```

- [ ] **Step 2: Replace `tailwind.config.ts` with design system tokens**

```typescript
import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        surface: 'hsl(var(--surface))',
        'event-positive': 'hsl(var(--event-positive))',
        'event-negative': 'hsl(var(--event-negative))',
        'event-warning': 'hsl(var(--event-warning))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-roboto-flex)', ...fontFamily.sans],
      },
      keyframes: {
        'flash-positive': {
          from: { backgroundColor: 'hsla(140, 70%, 50%, 0.3)' },
          to: { backgroundColor: 'transparent' },
        },
        'flash-negative': {
          from: { backgroundColor: 'hsla(0, 80%, 60%, 0.3)' },
          to: { backgroundColor: 'transparent' },
        },
        'pulse-sub': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'flash-positive': 'flash-positive 0.7s ease-out',
        'flash-negative': 'flash-negative 0.7s ease-out',
        'pulse-sub': 'pulse-sub 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}

export default config
```

- [ ] **Step 3: Replace `src/app/globals.css` with dark theme variables**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 18% 8%;
    --foreground: 210 20% 90%;

    --card: 220 18% 11%;
    --card-foreground: 210 20% 90%;

    --popover: 220 18% 11%;
    --popover-foreground: 210 20% 90%;

    --primary: 140 70% 50%;
    --primary-foreground: 220 18% 8%;

    --secondary: 220 15% 15%;
    --secondary-foreground: 210 20% 90%;

    --muted: 220 15% 15%;
    --muted-foreground: 210 15% 55%;

    --accent: 220 15% 18%;
    --accent-foreground: 210 20% 90%;

    --destructive: 0 80% 60%;
    --destructive-foreground: 210 20% 90%;

    --border: 220 15% 15%;
    --input: 220 15% 18%;
    --ring: 140 70% 50%;
    --radius: 0.5rem;

    --surface: 220 18% 11%;
    --event-positive: 140 70% 50%;
    --event-negative: 0 80% 60%;
    --event-warning: 45 100% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer utilities {
  .tabular-nums {
    font-feature-settings: 'tnum';
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 4: Verify the build passes**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm run build 2>&1 | tail -20
```

Expected: `Route (app)` table printed, no errors.

- [ ] **Step 5: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: dark theme design tokens and custom animations"
```

---

## Task 3: shadcn/ui init + essential components

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx` (and other shadcn components)

- [ ] **Step 1: Run shadcn init (non-interactive)**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx shadcn@latest init \
  --defaults \
  --base-color neutral \
  --css-variables \
  --yes
```

If `--defaults` is not available in the installed version, run interactively and choose:
- Style: Default
- Base color: Neutral
- CSS variables: yes

- [ ] **Step 2: Add essential UI components**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx shadcn@latest add button input label badge separator dialog sonner --yes
```

- [ ] **Step 3: Verify `src/lib/utils.ts` exists and exports `cn`**

```bash
cd /workspace/repositories/draft-duel-game-frontend
grep -n "cn" src/lib/utils.ts
```

Expected: `export function cn(` line present.

- [ ] **Step 4: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add -A
git commit -m "feat: add shadcn/ui with dark theme components"
```

---

## Task 4: Install runtime dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime packages**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm install \
  @tanstack/react-query@^5 \
  socket.io-client@^4 \
  framer-motion \
  zod
```

- [ ] **Step 2: Install dev packages**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm install -D \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/jest-dom \
  jsdom \
  @playwright/test \
  @types/node
```

- [ ] **Step 3: Install Playwright browsers**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx playwright install chromium --with-deps
```

- [ ] **Step 4: Verify packages resolved**

```bash
cd /workspace/repositories/draft-duel-game-frontend
node -e "require('@tanstack/react-query'); require('socket.io-client'); require('framer-motion'); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add package.json package-lock.json
git commit -m "chore: add runtime and dev dependencies"
```

---

## Task 5: Environment config

**Files:**
- Create: `src/lib/env.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Create `src/lib/env.ts`**

```typescript
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_WS_URL: z.string().default('http://localhost:3001'),
})

export const env = schema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
})
```

- [ ] **Step 2: Create `.env.local.example`**

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

- [ ] **Step 3: Verify the module parses without errors**

```bash
cd /workspace/repositories/draft-duel-game-frontend
node -e "
const { register } = require('module');
// just check schema doesn't throw with defaults
const { z } = require('zod');
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_WS_URL: z.string().default('http://localhost:3001'),
});
const result = schema.parse({});
console.log(result);
"
```

Expected: `{ NEXT_PUBLIC_API_URL: 'http://localhost:3001', NEXT_PUBLIC_WS_URL: 'http://localhost:3001' }`.

- [ ] **Step 4: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/lib/env.ts .env.local.example
git commit -m "feat: Zod-validated environment config"
```

---

## Task 6: Domain types

**Files:**
- Create: `src/types/domain.ts`

- [ ] **Step 1: Create `src/types/domain.ts`**

```typescript
export type Position = 'GOL' | 'LAT' | 'ZAG' | 'MEI' | 'ATA'

export type ActionType =
  | 'GOL' | 'ASS' | 'RB' | 'DS' | 'PE'
  | 'DEF' | 'SG' | 'DD' | 'DP' | 'GS'
  | 'FF' | 'FS' | 'FT' | 'I' | 'GC' | 'PP'
  | 'CA' | 'CV'

export type RoomStatus = 'waiting' | 'drafting' | 'live' | 'finished'

export type Role = 'host' | 'guest'

export type Winner = 'host' | 'guest' | 'draw' | 'abandoned'

export interface User {
  id: string
  email: string
  nickname: string
}

export interface Championship {
  id: string
  slug: string
  name: string
  kind: 'league' | 'cup'
}

export interface Team {
  id: string
  name: string
  shortName: string
  abbreviation: string
  crestUrl: string | null
  primaryColor: string
  secondaryColor: string
}

export interface Athlete {
  id: string
  name: string
  shortName: string
  position: Position
  jerseyNumber: number | null
  team: Team
}

export interface Match {
  id: string
  championshipId: string
  kickoffAt: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed'
  currentMinute: number | null
  homeScore: number | null
  awayScore: number | null
  homeTeam: Team
  awayTeam: Team
  lineupsConfirmedAt: string | null
}

export interface DraftPick {
  pickNumber: number
  role: Role
  athleteId: string
}

export interface LineupInterval {
  athleteId: string
  validFromMinute: number
  validToMinute: number | null
}

export interface Room {
  id: string
  code: string
  matchId: string
  status: RoomStatus
  currentPickNumber: number
  hostScore: number | null
  guestScore: number | null
  winner: Winner | null
  hostUserId: string
  guestUserId: string | null
  draftPicks: DraftPick[]
  hostIntervals: LineupInterval[]
  guestIntervals: LineupInterval[]
}

export interface MatchEvent {
  eventId: string
  athleteId: string
  action: ActionType
  minute: number
  points: number
  affectedRole: Role | null
}

export const ACTION_LABELS: Record<ActionType, string> = {
  GOL: 'Gol',
  ASS: 'Assistência',
  RB: 'Roubada de Bola',
  DS: 'Desarme',
  PE: 'Passe Errado',
  FF: 'Falta Sofrida',
  FS: 'Falta Cometida',
  FT: 'Finalização na Trave',
  I: 'Impedimento',
  GC: 'Gol Contra',
  PP: 'Pênalti Perdido',
  DEF: 'Defesa',
  SG: 'Jogo sem Sofrer Gol',
  DD: 'Defesa Difícil',
  DP: 'Defesa de Pênalti',
  GS: 'Gol Sofrido',
  CA: 'Cartão Amarelo',
  CV: 'Cartão Vermelho',
}

export const POSITION_ORDER: Position[] = ['GOL', 'LAT', 'ZAG', 'MEI', 'ATA']
```

- [ ] **Step 2: Verify TypeScript accepts the file**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/types/domain.ts
git commit -m "feat: shared domain types"
```

---

## Task 7: API client utility

**Files:**
- Create: `src/lib/api.ts`

- [ ] **Step 1: Create `src/lib/api.ts`**

```typescript
import { env } from '@/lib/env'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(res.status, (body as { message?: string }).message ?? res.statusText)
  }

  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}
```

- [ ] **Step 2: Verify TypeScript accepts the file**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/lib/api.ts
git commit -m "feat: fetch-based API client with credentials and error class"
```

---

## Task 8: Auth utilities and useAuth hook

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/hooks/useAuth.ts`

- [ ] **Step 1: Create `src/lib/auth.ts`**

```typescript
export function getLoginPath(callbackPath?: string): string {
  if (callbackPath) {
    return `/login?from=${encodeURIComponent(callbackPath)}`
  }
  return '/login'
}
```

- [ ] **Step 2: Create `src/hooks/useAuth.ts`**

```typescript
'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { User } from '@/types/domain'

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/me').catch(() => null),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return { user: user ?? null, isLoading }
}

export function useInvalidateAuth() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['me'] })
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/lib/auth.ts src/hooks/useAuth.ts
git commit -m "feat: auth utilities and useAuth hook"
```

---

## Task 9: Socket.IO client and useSocket hook

**Files:**
- Create: `src/lib/socket.ts`
- Create: `src/hooks/useSocket.ts`
- Create: `src/hooks/useRoom.ts`

- [ ] **Step 1: Create `src/lib/socket.ts`**

```typescript
import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(env.NEXT_PUBLIC_WS_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket'],
    })
  }
  return socket
}

export function connectSocket(): void {
  getSocket().connect()
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
```

- [ ] **Step 2: Create `src/hooks/useSocket.ts`**

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { type Socket } from 'socket.io-client'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'

export function useSocket(): Socket {
  const socketRef = useRef<Socket>(getSocket())

  useEffect(() => {
    connectSocket()
    return () => {
      disconnectSocket()
    }
  }, [])

  return socketRef.current
}
```

- [ ] **Step 3: Create `src/hooks/useRoom.ts` (stub)**

```typescript
'use client'

// Stub — implemented in the room feature plan.
// Returns the full room state and event handlers for the room page.
export function useRoom(_roomId: string) {
  return {
    room: null,
    isLoading: true,
    myRole: null as 'host' | 'guest' | null,
    pick: (_athleteId: string) => {},
    substitute: (_removeAthleteId: string, _addAthleteId: string) => {},
    abandon: () => {},
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/lib/socket.ts src/hooks/useSocket.ts src/hooks/useRoom.ts
git commit -m "feat: Socket.IO client singleton and useSocket hook"
```

---

## Task 10: Providers wrapper

**Files:**
- Create: `src/providers/index.tsx`

- [ ] **Step 1: Create `src/providers/index.tsx`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/providers/index.tsx
git commit -m "feat: QueryClientProvider and Toaster wrapper"
```

---

## Task 11: Root layout, auth layout, app layout

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Roboto_Flex } from 'next/font/google'
import './globals.css'
import { Providers } from '@/providers'

const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  variable: '--font-roboto-flex',
})

export const metadata: Metadata = {
  title: 'Draft Duel',
  description: 'Draft snake 1v1 com partidas ao vivo de futebol',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={robotoFlex.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/(app)/layout.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
```

- [ ] **Step 4: Verify build**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/app/layout.tsx src/app/\(auth\)/layout.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: root layout with Roboto Flex, auth layout, app layout with auth guard"
```

---

## Task 12: Page shells

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/verify/page.tsx`
- Create: `src/app/(app)/championships/[slug]/page.tsx`
- Create: `src/app/(app)/matches/[id]/page.tsx`
- Create: `src/app/(app)/rooms/[id]/page.tsx`
- Create: `src/app/(app)/me/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Escolha um campeonato</h1>
      <p className="text-muted-foreground mt-2">Brasileirão · Copa do Mundo</p>
    </main>
  )
}
```

- [ ] **Step 2: Create `src/app/(auth)/login/page.tsx`**

```tsx
export default function LoginPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Entrar no Draft Duel</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Digite seu email e enviaremos um link de acesso.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/(auth)/verify/page.tsx`**

```tsx
export default function VerifyPage() {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold mb-2">Verificando...</h1>
      <p className="text-muted-foreground text-sm">Confirmando seu link de acesso.</p>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/app/(app)/championships/[slug]/page.tsx`**

```tsx
export default async function ChampionshipPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold capitalize">{slug.replace(/-/g, ' ')}</h1>
      <p className="text-muted-foreground mt-2">Rodada atual · Partidas</p>
    </main>
  )
}
```

- [ ] **Step 5: Create `src/app/(app)/matches/[id]/page.tsx`**

```tsx
export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Partida</h1>
      <p className="text-muted-foreground mt-2 text-sm font-mono">{id}</p>
    </main>
  )
}
```

- [ ] **Step 6: Create `src/app/(app)/rooms/[id]/page.tsx`**

```tsx
export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Sala</h1>
      <p className="text-muted-foreground mt-2 text-sm font-mono">{id}</p>
    </main>
  )
}
```

- [ ] **Step 7: Create `src/app/(app)/me/page.tsx`**

```tsx
export default function MePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>
      <p className="text-muted-foreground mt-2">Histórico de salas e configurações.</p>
    </main>
  )
}
```

- [ ] **Step 8: Verify build**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm run build 2>&1 | tail -30
```

Expected: all routes listed in the Route table, build succeeds.

- [ ] **Step 9: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/app/page.tsx \
  src/app/\(auth\)/login/page.tsx \
  src/app/\(auth\)/verify/page.tsx \
  src/app/\(app\)/championships \
  src/app/\(app\)/matches \
  src/app/\(app\)/rooms \
  src/app/\(app\)/me
git commit -m "feat: all route shells (home, auth, championship, match, room, profile)"
```

---

## Task 13: JerseyIcon and PlayerCard components

**Files:**
- Create: `src/components/JerseyIcon.tsx`
- Create: `src/components/PlayerCard.tsx`

- [ ] **Step 1: Create `src/components/JerseyIcon.tsx`**

```tsx
import { cn } from '@/lib/utils'

const sizeMap = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
} as const

interface JerseyIconProps {
  jerseyNumber: number | null
  primaryColor: string
  secondaryColor: string
  size?: keyof typeof sizeMap
  className?: string
}

export function JerseyIcon({
  jerseyNumber,
  primaryColor,
  secondaryColor,
  size = 'md',
  className,
}: JerseyIconProps) {
  return (
    <div
      className={cn(
        sizeMap[size],
        'rounded flex items-center justify-center font-semibold shrink-0',
        className,
      )}
      style={{
        backgroundColor: primaryColor,
        color: secondaryColor,
        border: `1px solid ${secondaryColor}33`,
      }}
    >
      {jerseyNumber ?? '?'}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/PlayerCard.tsx`**

```tsx
'use client'

import { cn } from '@/lib/utils'
import { JerseyIcon } from '@/components/JerseyIcon'
import type { Position } from '@/types/domain'

interface PlayerCardProps {
  shortName: string
  position: Position
  jerseyNumber: number | null
  teamPrimaryColor: string
  teamSecondaryColor: string
  score?: number
  onClick?: () => void
  isSelected?: boolean
  isRemoved?: boolean
  flashType?: 'positive' | 'negative' | null
  compact?: boolean
}

export function PlayerCard({
  shortName,
  position,
  jerseyNumber,
  teamPrimaryColor,
  teamSecondaryColor,
  score,
  onClick,
  isSelected,
  isRemoved,
  flashType,
  compact,
}: PlayerCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface transition-all',
        onClick && 'cursor-pointer hover:bg-accent',
        isSelected ? 'ring-2 ring-primary' : 'shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        isRemoved && 'opacity-30',
        flashType === 'positive' && 'animate-flash-positive',
        flashType === 'negative' && 'animate-flash-negative',
        compact && 'py-1',
      )}
    >
      <span className="px-1.5 py-0.5 text-[0.65rem] font-semibold rounded bg-secondary text-muted-foreground uppercase tracking-wider">
        {position}
      </span>
      <JerseyIcon
        jerseyNumber={jerseyNumber}
        primaryColor={teamPrimaryColor}
        secondaryColor={teamSecondaryColor}
        size="sm"
      />
      <span className="text-sm font-medium truncate flex-1">{shortName}</span>
      {score !== undefined && (
        <span
          className={cn(
            'text-sm font-semibold tabular-nums min-w-[3rem] text-right',
            score > 0
              ? 'text-event-positive'
              : score < 0
                ? 'text-event-negative'
                : 'text-muted-foreground',
          )}
        >
          {score.toFixed(1)}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add src/components/JerseyIcon.tsx src/components/PlayerCard.tsx
git commit -m "feat: JerseyIcon and PlayerCard components ported and typed"
```

---

## Task 14: Vitest setup and unit tests

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `test/unit/JerseyIcon.test.tsx`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Add test scripts to `package.json`**

Open `package.json` and add/replace in the `"scripts"` block:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Create `test/unit/JerseyIcon.test.tsx`**

```bash
mkdir -p test/unit
```

```tsx
import { render, screen } from '@testing-library/react'
import { JerseyIcon } from '@/components/JerseyIcon'

describe('JerseyIcon', () => {
  it('renders the jersey number', () => {
    render(
      <JerseyIcon jerseyNumber={10} primaryColor="#cc0000" secondaryColor="#ffffff" />,
    )
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders ? when number is null', () => {
    render(
      <JerseyIcon jerseyNumber={null} primaryColor="#cc0000" secondaryColor="#ffffff" />,
    )
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies the lg size class', () => {
    const { container } = render(
      <JerseyIcon jerseyNumber={7} primaryColor="#003399" secondaryColor="#ffffff" size="lg" />,
    )
    expect(container.firstChild).toHaveClass('w-10', 'h-10', 'text-base')
  })
})
```

- [ ] **Step 5: Run tests**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm test 2>&1
```

Expected:
```
✓ test/unit/JerseyIcon.test.tsx (3)
  ✓ renders the jersey number
  ✓ renders ? when number is null
  ✓ applies the lg size class

Test Files  1 passed (1)
Tests       3 passed (3)
```

- [ ] **Step 6: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add vitest.config.ts src/test/setup.ts test/unit/JerseyIcon.test.tsx package.json
git commit -m "test: Vitest setup and JerseyIcon unit tests"
```

---

## Task 15: Playwright setup and smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `test/e2e/home.spec.ts`
- Modify: `package.json` (add e2e script)

- [ ] **Step 1: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
```

- [ ] **Step 2: Create `test/e2e/home.spec.ts`**

```bash
mkdir -p test/e2e
```

```typescript
import { test, expect } from '@playwright/test'

test('home page loads with championship heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /campeonato/i })).toBeVisible()
})

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible()
})
```

- [ ] **Step 3: Add e2e script to `package.json`**

Add in `"scripts"`:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Run e2e tests**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm run test:e2e 2>&1 | tail -20
```

Expected:
```
2 passed (...)
```

- [ ] **Step 5: Commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add playwright.config.ts test/e2e/home.spec.ts package.json
git commit -m "test: Playwright setup and home/login smoke tests"
```

---

## Task 16: Final cleanup and .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ensure `.env.local` and Playwright output are gitignored**

Verify `.gitignore` contains these entries (add if missing):
```
.env.local
.env*.local
/playwright-report/
/test-results/
```

```bash
cd /workspace/repositories/draft-duel-game-frontend
grep -E "\.env\.local|playwright-report|test-results" .gitignore || echo "MISSING — add them"
```

If `MISSING`, append to `.gitignore`:
```bash
cat >> .gitignore << 'EOF'

# local env
.env.local
.env*.local

# Playwright
/playwright-report/
/test-results/
EOF
```

- [ ] **Step 2: Final build + test pass**

```bash
cd /workspace/repositories/draft-duel-game-frontend
npm run build 2>&1 | tail -10 && npm test 2>&1 | tail -10
```

Expected: build succeeds, all 3 unit tests pass.

- [ ] **Step 3: Final commit**

```bash
cd /workspace/repositories/draft-duel-game-frontend
git add .gitignore
git commit -m "chore: finalize gitignore for env and Playwright artifacts"
```

---

## Self-Review: Spec Coverage Check

| Spec section | Coverage |
|---|---|
| §10.2 Frontend directory structure | ✅ All paths created (app/, components/, hooks/, lib/) |
| §3 Tech decisions (Next.js, Tailwind, shadcn, TanStack Query, Framer Motion, Socket.IO) | ✅ All installed; Framer Motion installed, used in feature plans |
| §2.3 Auth (magic link, httpOnly cookies) | ✅ useAuth via GET /me; no client-side JWT decode; auth guard in app layout |
| §7.1 REST base URL configurable | ✅ env.ts → NEXT_PUBLIC_API_URL |
| §7.2 WebSocket auth via cookie | ✅ socket.ts sets withCredentials: true |
| §9.3 Cross-domain / same-origin | ✅ credentials: 'include' on all fetch; WS withCredentials |
| §2.5 JerseyIcon (no player photos) | ✅ JerseyIcon uses jersey number + team colors |
| §11.2 Frontend tests (Vitest + Playwright) | ✅ Both configured with first tests |
| `@draft-duel/contracts` package | ⏳ Types defined locally in `src/types/domain.ts` — extracted to shared package in a later task |

No placeholders found. All code blocks contain complete, runnable content.
