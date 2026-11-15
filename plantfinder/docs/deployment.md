# Deployment guide

Two ways to run PlantFinder:

| | **Free static site (recommended)** | Self-hosted server |
|---|---|---|
| Cost | **$0**: GitHub Pages + GitHub Actions (public repository) | $0 on your own computer; about $0–7/month hosted |
| Data | Snapshot of all 6 sources, refreshed 3× a day | Live per search (cached 30 min / 6 h) |
| Privacy of nursery data | Encrypted (AES-GCM); passphrase needed | Must stay private (`PF_SOURCE_POLICY=personal`) |
| Maintenance | None (scheduled workflow) | Keep a process running |
| Photo identification | Optional free Pl@ntNet key (visible to site visitors) | Key stays on the server |

## Option 1: free static site on GitHub Pages

How it works: `.github/workflows/plantfinder-site.yml` runs 3 times a day (and on every push to `main`).
It runs the unit tests, builds the static web app, fetches the full public catalog of each audited source
(robots-checked, one request at a time per host, about 100 requests and 3 minutes in total), keeps plants
only, encrypts the snapshot with your passphrase, and publishes to GitHub Pages. The browser decrypts and
searches locally, with the same strict rules as the API.

### One-time setup (about 3 minutes, no payment details)
1. **Merge** the PlantFinder branch into `main`. Scheduled workflows and Pages deployments run from the default branch.
2. GitHub → repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → New repository secret**:
   - `PF_SNAPSHOT_PASSPHRASE`: required, at least 12 characters (e.g. four random words). You type it once per device.
   - `PLANTNET_API_KEY`: optional. Create a free account at my.plantnet.org (500 identifications/day free).
     It is embedded in the static site, so anyone who has the site can see it. The free plan cannot incur
     charges; at worst the daily quota is used up.
4. **Actions → PlantFinder site → Run workflow.** After about 5 minutes the site is at
   `https://danielsharon1.github.io/daniel-sharon/`.

### What to expect
- Data freshness: the banner shows when the snapshot was taken. If a source fails, its previous data
  (under 72 h old) is kept and labelled. If **no** source can be refreshed, the run fails, GitHub emails
  you, and the site keeps its last good version.
- Every week the workflow commits `docs/source-health.md` (counts only). This also stops GitHub from pausing
  the schedule, which it does after 60 days without commits in public repositories.
- Free limits: public repositories get unlimited Actions minutes. Pages allows 1 GB per site and 100 GB of
  bandwidth per month; the snapshot is about 0.3 MB.

### Extension with the free site
Its default address is the Pages site. Enter the same passphrase in the extension's **Options**.

---

## Option 2: self-hosted server

### What gets deployed
One Node 22 process (Fastify) that serves the API **and** the built web app. The Chrome extension is
distributed separately and points at this server's URL. A `personal` policy server must not be publicly reachable.

### Configuration (`.env.example`)

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

### Option 2a: Docker (any host)
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

### Option 2b: Render / Railway / Fly.io (managed)
- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start` (= `node services/api/dist/server.js`)
- Health check path: `/api/health`
- Persistent disk (optional): mount it and set `PF_DATA_DIR`.

### Option 2c: on your own computer
```bash
cd plantfinder && pnpm install && pnpm build
pnpm start            # http://127.0.0.1:8787, live sources
```
Load the extension (`docs/extension.md`); its default server is `http://localhost:8787`.

### Expected costs for a hosted server (estimates, verify at signup)
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
