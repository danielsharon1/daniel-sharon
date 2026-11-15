# PlantFinder

Israel-first plant search and price comparison: a Hebrew RTL web app (English optional) and a Chrome MV3
extension on one shared API. Every offer links to its source and shows the check time, the verified seller
location, and how confidently the plant was identified. No fabricated listings.

**Status:** v0.1 working personal pilot, 6 live sources. Not yet authorized for public use. See
[`docs/RELEASE_STATUS.md`](docs/RELEASE_STATUS.md).

## Quick start

Requirements: Node ≥ 20.11, pnpm 10 (`corepack enable`).

```bash
cd plantfinder
pnpm install

# Offline demo: real recorded source snapshots, labelled DEMO in the UI, no network needed
PF_DATA_MODE=fixture pnpm dev          # web http://localhost:5173  (API :8787)

# Live sources (needs outbound HTTPS to the nursery sites)
pnpm build && pnpm start               # http://127.0.0.1:8787
```

Try: `מונסטרה`, city `נתניה`, max price `150`. That's the benchmark; see `docs/evaluation.md`.

Chrome extension: `pnpm --filter @plantfinder/extension build`, then load `apps/extension/build` unpacked
([`docs/extension.md`](docs/extension.md)).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | API (tsx watch) + Vite dev server |
| `pnpm build` | Web build, API bundle (`services/api/dist/server.js`), extension build + zip |
| `pnpm start` | Production server (API + web) |
| `pnpm typecheck` | TypeScript across all packages, tests and scripts |
| `pnpm test` | Unit, integration and evaluation-regression tests (Vitest) |
| `pnpm test:e2e` | Playwright: web flows, axe accessibility, extension in Chromium |
| `pnpm check` | All of the above |
| `pnpm eval` | **Live** evaluation: link validity, price extraction vs product pages, 20-search stability |
| `pnpm eval:species` | Species accuracy on the labelled holdout |
| `pnpm --filter @plantfinder/api record-fixtures [queries…]` | Re-record real source snapshots for DEMO mode and tests |
| `pnpm gazetteer [IL.txt alt/IL.txt]` | Rebuild the Israeli locality gazetteer from GeoNames |

Configuration: [`.env.example`](.env.example). Nothing is required for the demo.

## Layout

```
packages/shared   types, Hebrew/English normalisation, taxonomy + classifier, size parser, geo, search core
services/api      Fastify API, source adapters (WooCommerce, Shopify), polite transport, Pl@ntNet, fixtures
apps/web          Vite + React web app (RTL/LTR, light/dark)
apps/extension    Chrome MV3 extension (plain JS)
eval              labelled evaluation sets, live evaluation script, results
e2e               Playwright tests
docs              PRD, architecture, source audit, decisions, roadmap, evaluation, security, deployment
```

## Docs
[PRD](docs/PRD.md) · [Architecture](docs/architecture.md) · [Source audit](docs/source-audit.md) ·
[Decisions](docs/decisions.md) · [Roadmap](docs/roadmap.md) · [Evaluation](docs/evaluation.md) ·
[Security review](docs/security-review.md) · [Deployment](docs/deployment.md) ·
[Extension](docs/extension.md) · [Partner outreach](docs/partner-outreach.md) ·
[Release status](docs/RELEASE_STATUS.md)

## Data and attribution
Listings come from the sellers' public catalog endpoints and are linked back to each product page. Locality
data © GeoNames (CC BY 4.0). Plant identification by Pl@ntNet (when configured).
