# Draft Duel — Evolução da arquitetura de rede

**Data:** 2026-05-05
**Status:** Substitui as decisões das seções 9.3, 12 e 13.1 do spec original. Demais seções inalteradas.
**Spec base:** [`2026-05-01-draft-duel-rebuild-design.md`](./2026-05-01-draft-duel-rebuild-design.md)

---

## 1. Contexto

O spec original (2026-05-01) definiu **rewrite na Vercel (`/api/*` → Fly)** como mecanismo preferido pra resolver:

- Cookies httpOnly de auth sem dor de cross-domain
- Mitigação de Safari ITP / Brave bloqueando cookies em subdomínio
- CORS implícito (mesma origem)

A motivação foi sólida do ponto de vista de DX, mas durante revisão da camada de transporte ficou claro que a decisão mistura mal com o uso intensivo de WebSocket que o produto exige (sala live por 90min+ com Socket.IO).

---

## 2. Problemas identificados com o rewrite

### 2.1 WebSocket via rewrite na Vercel

O Draft Duel mantém **uma conexão WS por jogador durante toda a partida** (criação 1h antes do kickoff + 90min + acréscimos = ~3h em casos comuns). Roteando WS por rewrite da Vercel:

- **Timeout de conexão.** Limites de duração de conexão da Vercel (variam por plano e mudam com frequência) forçam reconexões periódicas. Cada reconexão exige re-emissão de `room:join` + reconciliação de estado — barulho desnecessário num caminho que não é confiável.
- **Sem garantia de stickiness no proxy.** Hoje single-instance esconde o problema. No dia que ligarmos Redis adapter pra escalar (~1 dia de trabalho, conforme spec), reaparece — sem stickiness, hand-off de WS entre instâncias fica pior.
- **Custo metered.** Edge requests + bandwidth da Vercel cobrados por uso. Conexão WS de 3h consome muito mais do que requests REST esporádicos.
- **Hop extra.** Browser → Vercel edge → Fly GRU → volta. Pra REST custa 20–80ms; pra WS impacta latência percebida em cada `match:event` durante a partida.

### 2.2 REST via rewrite

Aqui o custo é menor mas não-zero:

- Bandwidth/edge requests da API toda passando pela Vercel
- 1 hop extra em todo request (mesmo problema, magnitude menor)
- Acoplamento operacional desnecessário entre web e API (deploy da Vercel pode afetar disponibilidade da API)

### 2.3 Reavaliação do problema original

A premissa "ITP/Brave bloqueiam cookies em subdomínio" foi imprecisa:

- ITP do Safari trata cookies como **first-party** quando origem e API compartilham o mesmo registrable domain (eTLD+1). `draftduel.com` e `api.draftduel.com` compartilham `draftduel.com` → first-party.
- Brave segue lógica equivalente (same-site = same eTLD+1).
- Bloqueio cross-domain real só ataca origens com eTLD+1 distintos (ex: tracker terceiro).

Logo, o "ganho" de mitigar ITP via rewrite era em grande parte **inexistente** pro nosso caso.

---

## 3. Nova decisão

| Tráfego | Caminho |
|---|---|
| Web estático | Vercel (`draftduel.com`) |
| REST API | `api.draftduel.com` direto (Fly) |
| WebSocket | `api.draftduel.com` direto (Fly) |
| Cookies de auth | escopo `Domain=.draftduel.com` (parent domain) |
| CORS | API responde com `Access-Control-Allow-Origin: https://draftduel.com` + `Access-Control-Allow-Credentials: true` |

**Vercel deixa de fazer proxy de API.** Apenas serve o front estático (Next.js).

### 3.1 Configuração de cookie

```
Set-Cookie: dd_access=<jwt>; HttpOnly; Secure; SameSite=Lax;
            Domain=.draftduel.com; Path=/; Max-Age=900

Set-Cookie: dd_refresh=<opaque>; HttpOnly; Secure; SameSite=Lax;
            Domain=.draftduel.com; Path=/auth/refresh; Max-Age=2592000
```

`SameSite=Lax` continua compatível com o fluxo de magic link (top-level navigation do email pro `/auth/verify`).

### 3.2 CORS na API (Nest + Fastify)

```ts
// main.ts
app.enableCors({
  origin: env.WEB_ORIGIN,            // https://draftduel.com
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  maxAge: 86400,                     // cache do preflight
})
```

Em dev, `WEB_ORIGIN=http://localhost:3000`.

### 3.3 Socket.IO

Cliente:
```ts
io('https://api.draftduel.com', {
  withCredentials: true,
  transports: ['websocket'],         // pula long-polling, vai direto pra WS
})
```

Server (gateway):
```ts
@WebSocketGateway({
  cors: { origin: env.WEB_ORIGIN, credentials: true },
})
```

Cookie `dd_access` é enviado automaticamente no handshake (mesmo eTLD+1 + `withCredentials: true`).

---

## 4. Comparação

| Dimensão | Rewrite Vercel (spec original) | Subdomínio direto (nova decisão) |
|---|---|---|
| Cookies cross-domain | "resolvido" via mesma origem | resolvido via `Domain=.draftduel.com` (~3 linhas) |
| CORS | desnecessário | preflight + headers configurados (~10 linhas Nest) |
| Latência REST | +1 hop edge (~20–80ms) | direto (Fly GRU) |
| Latência WS | +1 hop edge + reconexões | direto, conexão estável |
| Timeout WS | sujeito a limites da Vercel | controlado por nós (Fly + Socket.IO ping/pong) |
| Custo de bandwidth | API toda metered na Vercel | só estático na Vercel |
| Acoplamento operacional | web ↕ API via Vercel | independentes |
| Risco ITP/Brave | "mitigado" (na prática inexistente) | inexistente (same eTLD+1) |
| Pronto pra Redis multi-instance | precisa stickiness no proxy | independente do front |

---

## 5. O que muda no spec original

### 5.1 Seção 9.3 — Cross-domain / cookies

**Antes:** "Web em `draftduel.com`, API em `api.draftduel.com`: cookies precisam do parent domain (`.draftduel.com`), Secure + SameSite=Lax. CORS API com `credentials: true`. **Alternativa preferida:** rewrite no Vercel mapeando `/api/*` → backend Fly."

**Depois:** Subdomínio direto é a abordagem oficial. Cookies com `Domain=.draftduel.com`, `Secure`, `SameSite=Lax`. CORS configurado na API com `credentials: true` e `origin` restrito a `WEB_ORIGIN`. Rewrite na Vercel descartado.

### 5.2 Seção 12 — Tabela de deploy

**Antes:**
| Web | Vercel (com rewrite `/api/*` → Fly) |

**Depois:**
| Web | Vercel (somente front estático) |
| API | Fly.io (região GRU) — `api.draftduel.com` |

### 5.3 Seção 13.1 — Riscos de prazo

Remover o item "Cookies cross-domain (Safari ITP / Brave)" — não é mais risco material. Substituir por:

> **Configuração de CORS.** API e front em origens distintas exigem CORS correto desde o dia 1. Risco baixo (config padrão Nest), mas regredir significa quebrar todo login. Coberto por teste E2E de auth.

---

## 6. O que permanece inalterado

- Toda a lógica de auth (magic link, sessions, JWT, refresh) — seções 9.1, 9.2, 9.4
- Modelo de dados — seção 5
- Lifecycle de sala — seção 6
- Contratos REST e WS — seção 7 (apenas o **transporte** muda, schemas seguem idênticos)
- StatsProvider e workers — seção 8
- Estrutura dos repositórios — seção 10
- Estratégia de testes — seção 11 (acrescentar caso E2E de CORS no item 11.1)

---

## 7. Riscos da nova abordagem

- **Drift de configuração CORS.** Se `WEB_ORIGIN` em produção não bater com o domínio real, login quebra silenciosamente em browser. Mitigação: env validado com Zod no boot + teste E2E que abre uma origem proibida e espera 403.
- **Cookie em subdomínio errado em dev.** Setar `Domain=.draftduel.com` em ambiente local não funciona (localhost). Solução: omitir `Domain` em dev (cookie host-only no `localhost`), aplicar `Domain=.draftduel.com` só quando `NODE_ENV=production`.
- **Preflight OPTIONS adiciona 1 RTT** na primeira chamada de cada endpoint distinto. Mitigado por `maxAge: 86400` no CORS (browser cacheia preflight por 24h).

---

## 8. Plano de validação

Ordem de execução durante a fase de implementação:

1. **Smoke local.** Front em `localhost:3000`, API em `localhost:3001`. Login completo + abertura de sala + WS funcionando com cookies.
2. **Teste E2E de CORS** (novo, integrar em 11.1):
   - Origem permitida → 200
   - Origem não-listada → 403 + sem `Access-Control-Allow-Origin` na resposta
3. **Teste E2E de auth no WS:** handshake sem cookie rejeita; com cookie válido aceita; cookie expirado durante conexão dispara `disconnect`.
4. **Smoke de produção** (após primeiro deploy):
   - Verificar `Set-Cookie` retornado por `/auth/verify` tem `Domain=.draftduel.com`
   - Verificar conexão WS sobrevive >2h (script de soak test ou observação real durante uma partida de teste)

---

## 9. Decisões fixadas neste documento

1. Rewrite na Vercel para `/api/*` está **descartado**.
2. API exposta diretamente em `api.draftduel.com`.
3. Cookies de auth com escopo `Domain=.draftduel.com`.
4. CORS configurado com origin restrito + credentials.
5. Vercel responsabilidade limitada ao Next.js estático.
