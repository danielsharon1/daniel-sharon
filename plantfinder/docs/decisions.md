# Decisions

| # | Decision | Why | Revisit when |
|---|---|---|---|
| D1 | Israel first; Hebrew RTL default, English optional | Target market; nursery data is Hebrew | — |
| D2 | One backend for web and extension | No duplicated logic; no keys in the extension | — |
| D3 | Vite React SPA served by the Fastify API (not Next.js) | No SSR need; one deployable; lower cost | SEO landing pages are needed |
| D4 | Official public catalog endpoints only (WooCommerce Store API, Shopify products.json); no HTML scraping for prices | Exact data, minimal load, honest access | A partner offers a feed |
| D5 | No database in v0.1; disk-persisted response cache; saved searches in localStorage | Nothing to store server-side yet; privacy by default | Accounts or alerts are added |
| D6 | Sources have a status; `PF_SOURCE_POLICY=public` enables only `partner` sources | Four of six pilot sources forbid commercial reuse without written permission | Permissions are signed |
| D7 | Facebook Marketplace and Yad2 are not integrated | No authorized access; terms forbid automation | An official partnership exists |
| D8 | Strict buckets; unknown location is never inside a radius | Ground-truth requirement; avoids misleading "near you" claims | — |
| D9 | Generic name → conventional species ("מונסטרה" = M. deliciosa), flagged "genus-default"; generic + unknown epithet → genus only | Matches Israeli trade usage without false equivalence for rare plants | The labelled evaluation shows user confusion |
| D10 | Collapse pot/colour variants per plant size; price "from" when they differ | 15 pot styles of one plant are noise; size is what buyers compare | — |
| D11 | Distances to the seller's location only; delivery coverage shown as text from the seller's own page, not computed | Delivery zones are not machine-readable for most sources | Partners provide zone data |
| D12 | Photo ID via Pl@ntNet, server-side key, never stored, candidates require user confirmation | Accuracy is probabilistic; key must stay secret | — |
| D13 | Fixture (DEMO) mode serves real recorded snapshots, labelled in the UI | Offline development and CI without loading the sources | — |
| D14 | No payments, deployment or account creation without the owner's approval | Project rules | — |
| D15 | Alerts deferred | Freshness is not yet proven over time (CLAUDE.md step 6) | After 2–4 weeks of live monitoring |
