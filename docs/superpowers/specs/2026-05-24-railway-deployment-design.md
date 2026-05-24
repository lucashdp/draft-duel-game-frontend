---
title: Railway Deployment Config
date: 2026-05-24
status: approved
---

## Goal

Make `draft-duel-game-frontend` deployable on Railway with minimal configuration, relying on Railway's native Next.js / Nixpacks auto-detection.

## Scope

Config files only — no CI/CD automation, no Dockerfile, no app code changes.

## Files

### `railway.toml` (new)

Declares build command, start command, health check path, and restart policy. Prevents Railway from guessing wrong values.

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### `package.json` (update)

Add `engines` field to pin Node 20 (matches CI):

```json
"engines": { "node": ">=20" }
```

### `.env.local.example` (update)

Add Railway service reference syntax as comments so developers know how to wire the services in the Railway dashboard:

```
# Railway service references (use in Railway dashboard → Variables):
# NEXT_PUBLIC_API_URL=${{api-service.RAILWAY_PUBLIC_URL}}
# NEXT_PUBLIC_WS_URL=${{api-service.RAILWAY_PUBLIC_URL}}
# NEXT_PUBLIC_WEB_ORIGIN=${{RAILWAY_PUBLIC_DOMAIN}}
```

## Environment Variables

| Variable | Railway reference | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `${{api-service.RAILWAY_PUBLIC_URL}}` | REST API base URL |
| `NEXT_PUBLIC_WS_URL` | `${{api-service.RAILWAY_PUBLIC_URL}}` | WebSocket base URL (same service) |
| `NEXT_PUBLIC_WEB_ORIGIN` | `${{RAILWAY_PUBLIC_DOMAIN}}` | App's own public URL for invite links |

## What Railway does automatically

- Detects Next.js via Nixpacks
- Injects `PORT` env var; Next.js 13.5+ respects it
- Serves the app on the assigned Railway domain

## Out of scope

- GitHub Actions deploy trigger
- Staging vs production environment split
- Dockerfile / standalone output optimization
