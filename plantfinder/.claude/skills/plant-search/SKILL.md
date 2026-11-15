---
name: plant-search
description: Search and compare Israeli plant listings by name, image, price and radius using the PlantFinder API and its audited sources.
---

# Plant search skill

When the user asks for a plant search:

1. Collect the plant name (Hebrew, English or scientific), and optionally a city, radius (km) and max price (₪).
2. Check that the API is running: `curl -s http://127.0.0.1:8787/api/health`. If it isn't, say that live results
   are unavailable and offer to start it (`cd plantfinder && pnpm build && pnpm start`, or
   `PF_DATA_MODE=fixture pnpm start` for the labelled demo snapshot). Never answer with invented offers.
3. Query: `GET /api/search?q=<name>&city=<city>&radiusKm=<km>&maxPrice=<₪>`
   (optional: `inStockOnly=false`, `sizes=S,M`, `sellerTypes=nursery`, `sort=distance`).
4. Report by bucket, using the API's own fields:
   - `match`: meets every filter (verified location within radius, price, stock).
   - `location_unknown`: online sellers without a verified address. Never present these as "near".
   - `outside_radius`: give the distance.
   - `related_species`: a different species or "species not stated". Not a match.
   For each offer give the title, price (`from` = price of the cheapest matching variant), seller, distance if
   any, `provenance.retrievedAt`, and the `url`. Mention `dataMode: fixture` as DEMO data if present.
5. Mention hidden counts (`hidden.overBudget`, `hidden.outOfStock`, …) and any source with status `error` or `blocked`.
6. Photo: `POST /api/identify` (multipart `image`, or JSON `{imageUrl}`). Present candidates with scores and ask
   the user to confirm before searching. A 503 `identify_unavailable` means no Pl@ntNet key is configured.

Coverage is limited to the audited sources in `GET /api/sources`. Never claim to cover all nurseries,
Facebook or Yad2.
