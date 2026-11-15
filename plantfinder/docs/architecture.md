# Architecture

```
 Browser (web app, he/en)          Chrome MV3 extension
 apps/web  (Vite + React)          apps/extension (plain JS)
        │  same origin                    │  CORS (chrome-extension://…)
        └──────────────┬──────────────────┘
                       ▼
            services/api  (Fastify, one Node process)
            ├─ /api/search  ─► SearchService
            │                   ├─ resolveQuery()        taxonomy → target taxon + source terms
            │                   ├─ adapters (parallel)   WooCommerce Store API │ Shopify products.json
            │                   │      └─ Transport: Caching → Live (robots, throttle, circuit) │ Fixture
            │                   ├─ buildListing()        classify, size, kind, flags, provenance
            │                   └─ evaluateListings()    dedupe → strict filters → buckets → sort
            ├─ /api/identify ─► Pl@ntNet (server-side key) + SSRF-guarded image fetch
            ├─ /api/sources, /api/suggest, /api/cities, /api/resolve, /api/health
            └─ static: apps/web/dist (strict CSP)
                       │
            packages/shared (TypeScript, no runtime deps)
            types · text normalisation · taxonomy (95 taxa, 582 names, 27 cultivars) · classifier · size parser ·
            product-kind detector · geo · gazetteer (GeoNames IL) · search-core
```

## Free static mode (GitHub Pages)

```
GitHub Actions (cron 3×/day)                          GitHub Pages (static, free)
  pnpm test                                             index.html + assets
  web build --mode static          ───────────────►     data/meta.json   (counts, crypto params)
  snapshot-build: fetchCatalog() × 6 sources            data/index.bin   (gzip + AES-GCM)
    → plants only → encrypt with PF_SNAPSHOT_PASSPHRASE          │
                                                                  ▼
                                    Browser / extension: passphrase → decrypt → searchSnapshot()
                                    (same strict evaluation as the API; gazetteer loaded lazily)
```
- `packages/shared/src/snapshot.ts`: format, encryption (WebCrypto) and `searchSnapshot()`.
- `services/api/src/snapshot-build.ts`: builder. Carries over a failed source's previous data for up to 72 h; refuses empty or unencrypted pilot output.
- `apps/web/src/static-client.ts`: implements the same `Client` interface as the API client.

## Why this shape

- **One backend for web and extension.** The extension is a thin client of the same API, so there is no
  duplicated search logic and no keys in the extension.
- **Vite SPA instead of Next.js.** A search tool needs no SSR. One Node process serves both the API and the
  static build, so there is a single deployable and lower cost. (`docs/decisions.md` D3)
- **No database.** Listings are fetched on demand through a URL-keyed response cache persisted to disk. Saved
  searches live in the browser. A database becomes useful only with accounts or alerts, and alerts are
  deferred until source freshness is proven. (D5)
- **Transport abstraction.** Adapters don't know whether data is live, cached, or a recorded fixture. That
  makes the same code testable offline, and lets DEMO mode serve real recorded snapshots labelled as such.

## Data model (packages/shared/src/types.ts)

`Listing` = one offer at one plant size from one source:
- `title`, `url` (https only, required), `imageUrl` (hot-linked), `variant` (representative variant +
  number of pot/colour options collapsed into it)
- `price {amount ILS, kind: fixed|from|unknown, regularAmount, onSale}`
- `availability: in_stock|out_of_stock|unknown`
- `size {sizeClass, potDiameterCm, heightCm, potVolumeL, evidence[]}`: parsed only from explicit text
- `classification {taxonId, scientificName, cultivar, level, confidence, matchedName}`
- `productKind: plant|accessory|unknown`
- `seller {name, type, location|null (with precision + evidence), pickup, delivery}`
- `provenance {method, endpoint, retrievedAt, demo}`
- `flags[]`: demo, stale, genus_only_name, price_from, location_unknown, permission_pending, …

`ResultItem` adds `bucket` and `distanceKm`. The distance is computed **only** when the seller has grounded
coordinates.

## Search pipeline

1. **Resolve.** The query is classified with the same classifier used for titles. "Monstera", "מונסטרה" and
   "Monstera deliciosa" all resolve to *Monstera deliciosa* and to the same source terms
   (`מונסטרה`, `monstera`), so the results are identical.
2. **Fetch.** WooCommerce: server-side search per term, plus one batched request for the variation prices of
   variable products. Shopify: the full catalog (a few pages), cached for 6 h and matched locally by term or
   by classified genus.
3. **Normalise.** Variants that differ only by pot or colour are collapsed per plant size (cheapest in stock;
   `price.kind = from` when prices differ). WooCommerce minor units are handled per response.
4. **Evaluate** (strict):
   - Accessories and unrelated items are hidden (counted).
   - Out of stock, over or under budget, size mismatch and seller-type mismatch are hidden (counted).
   - A **different species** goes to `related_species`, shown separately and collapsed.
   - Location: no verified location → `location_unknown`; beyond the radius → `outside_radius`; otherwise
     `match`. **Unknown is never treated as within the radius.**
   - Duplicates are removed: same source+URL+variant, or the same source listing an identical title,
     variant, price and stock twice.

## Classifier (packages/shared/src/taxonomy.ts)

Token-phrase matching over normalised text (niqqud and quotes stripped, final letters unified, one Hebrew
prefix letter allowed). The longest name wins, then the more specific level, then the more specific rank.
- A **cultivar** counts only if its species or genus is named in the same title.
- A **generic name followed by an unknown epithet** ("מונסטרה B.M.F") falls back to genus only, so a rare
  collector plant is never presented as the common species.
- Known trade mislabelling is encoded explicitly: Cordyline sold as "דרצנה", Stromanthe as "Calathea
  Triostar", M. karstenianum as "obliqua Peru".

## Location

- Seller coordinates come from the registry. Each has a stated precision (address or locality) and the
  evidence behind it.
- The user's location is either a city from the GeoNames gazetteer (1,151 Israeli localities, Hebrew and
  English names) or opt-in browser geolocation. Coordinates are coarsened to about 1 km on the server and
  never stored.

## Testing layers

| Layer | Tool | Where |
|---|---|---|
| Unit: text, taxonomy, size, product kind, gazetteer, strict evaluation | Vitest | `packages/shared/src/shared.test.ts` |
| Integration: robots, polite transport, cache, SSRF, adapters on recorded real data, HTTP API | Vitest + Fastify inject | `services/api/src/api.test.ts` |
| Evaluation regression: species accuracy on labeled real titles | Vitest | `eval/species.test.ts` |
| E2E: web flows, accessibility (axe), mobile, extension in Chromium | Playwright | `e2e/` |
| Live evaluation: links, prices, stability | script | `pnpm eval` |
