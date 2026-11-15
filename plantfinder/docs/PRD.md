# PlantFinder PRD

## Audience and problem
Israeli plant buyers search several nurseries, stores and listings by hand. Plant names vary (Hebrew,
English, Latin, misspellings), sizes are described inconsistently, and location and price information is
scattered. Online stores hide whether a "מונסטרה" is the common species or a rare variety.

## Core experience
- Search by Hebrew, English or scientific name, or by photo (with explicit confirmation).
- Each offer shows: source link, image, price in ILS (fixed or "from"), size, seller, verified location
  and distance, stock, check time, identification level and confidence.
- Filters: max and min price, radius from a city or the user's location, size, seller type, stock,
  similar species.
- Sorting by price, distance, freshness or identification accuracy.
- Coverage panel: which sources are searched, when each was last refreshed, and which sources are not
  included and why.
- Chrome extension: popup search; right-click an image, selected text or a page to search.

## Benchmark
Monstera deliciosa (מונסטרה), Netanya, 25 km, ≤ ₪150, all supported sources. The result must separate
confirmed matches, sellers with unknown location, and sellers outside the radius. No fabricated offers.

## Acceptance criteria (measurable)

| # | Criterion | How verified |
|---|---|---|
| A1 | Monstera / מונסטרה / Monstera deliciosa return identical, species-aware results | `api.test.ts` + `e2e/web.spec.ts` (identical item ids/buckets) |
| A2 | Strict Netanya/25 km/≤₪150 search never confirms unknown or out-of-range locations | API test + E2E on every match label |
| A3 | ≥3 authorized functioning adapters before broad coverage claims; otherwise report it | `source-audit.md`: 6 functioning, **0 with written permission** (reported) |
| A4 | ≥90% valid source links (live sample) | `pnpm eval` |
| A5 | ≥85% price extraction accuracy (live sample, independent page value) | `pnpm eval` |
| A6 | ≥90% species classification accuracy on a documented labelled set | `eval/` dev + blind holdouts |
| A7 | 20 repeated searches without critical failure | API test (fixture) + `pnpm eval` (live) |
| A8 | Responsive, accessible (WCAG 2.1 AA automated checks), RTL and English | Playwright + axe |
| A9 | MV3 extension loads unpacked, image context menu + popup, no exposed keys | Extension E2E + build validator |
| A10 | Tests and build pass; reproducible setup, env example, deployment guide | `pnpm check`, README, `deployment.md` |

Results: `RELEASE_STATUS.md`.

## Non-goals (v0.1)
Guaranteed Facebook/Yad2 coverage, scraping behind logins or bot protection, stock guarantees, purchasing,
estimated distances for sellers without a verified location, price alerts.

## Success metrics after launch
Searches per week, share of searches with ≥1 confirmed match, outbound clicks per source (the evidence
for partnership talks), and source freshness (share of results checked within 24 h).
