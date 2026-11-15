# Deployment guide

> No deployment has been made. Deploying requires the owner's approval (CLAUDE.md). A `personal` source
> policy deployment must not be publicly reachable; see `security-review.md`.

## What gets deployed
One Node 22 process (Fastify) that serves the API **and** the built web app. The Chrome extension is
distributed separately and points at this server's URL.

## Configuration (`.env.example`)

| Variable | Default | Notes |
|---|---|---|
| `PORT`, `HOST` | `8787`, `127.0.0.1` | Use `HOST=0.0.0.0` in containers |
| `PF_DATA_MODE` | `live` | `fixture` = recorded real snapshots, labelled DEMO (no network needed) |
| `PF_SOURCE_POLICY` | `personal` | `public` enables only sources with written permission |
| `PF_ALLOWED_ORIGINS` | `chrome-extension://*` | Pin to `chrome-extension://<published-id>` in production |
| `PLANTNET_API_KEY` | — | Optional; enables photo identification |
| `PF_DATA_DIR` | `services/api/.data` | Response cache (`http-cache.json`); mount a volume |
| `PF_TRUST_PROXY` | — | Set `1` behind a reverse proxy or load balancer |
| `NODE_USE_ENV_PROXY` | — | Set `1` only if outbound traffic must go through `HTTPS_PROXY` |

## Option A: Docker (any host)
```bash
cd plantfinder
docker build -t plantfinder .
docker run -d -p 8787:8787 -v plantfinder-data:/data \
  -e PF_SOURCE_POLICY=personal -e PF_ALLOWED_ORIGINS=chrome-extension://<id> \
  -e PLANTNET_API_KEY=... plantfinder
curl localhost:8787/api/health
```
The image runs as the `node` user, exposes 8787, and has a health check on `/api/health`.
*Verification note:* the image build could not run here (no Docker daemon). The same layout was reproduced
with `pnpm deploy --prod` and booted successfully (health, web app and search responded).

## Option B: Render / Railway / Fly.io (managed)
- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start` (= `node services/api/dist/server.js`)
- Health check path: `/api/health`
- Persistent disk (optional): mount it and set `PF_DATA_DIR`.

## Option C: personal use on your own computer (recommended now)
```bash
cd plantfinder && pnpm install && pnpm build
pnpm start            # http://127.0.0.1:8787, live sources
```
Load the extension (`docs/extension.md`); its default server is `http://localhost:8787`.

## Expected costs (estimates, verify at signup)
| Item | Estimate |
|---|---|
| Hosting (1 small instance, 512 MB RAM) | Free tier to about $7/month on Render, Railway or Fly |
| Pl@ntNet | Free tier for registered users (≈500 identifications/day, per their site); paid plans above that |
| Domain + TLS | about $10–15/year; TLS is free on the platforms above |
| Chrome Web Store developer account | one-time $5 |
| Database | none needed in v0.1 |

## Operations
- `GET /api/health`: mode, policy, enabled sources, photo identification availability.
- `GET /api/sources`: last refresh per source. Watch for sources stuck in `blocked` or `error`.
- Re-run `pnpm eval` periodically (weekly) and keep the JSON in `eval/results/`.
- Re-record fixtures after taxonomy or adapter changes: `pnpm --filter @plantfinder/api record-fixtures`.
- If a source starts returning bot challenges: the circuit opens automatically. **Do not work around it**;
  contact the source.

## Publishing the extension (owner action)
1. `pnpm --filter @plantfinder/extension build` → `apps/extension/plantfinder-extension.zip`.
2. Chrome Web Store developer dashboard → new item → upload the zip. Privacy tab: the extension sends the
   selected text, page title or image URL to the configured PlantFinder server only on user action.
3. After approval, set `PF_ALLOWED_ORIGINS=chrome-extension://<assigned id>` on the server.
