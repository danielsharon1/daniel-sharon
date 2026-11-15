# PlantFinder — Claude Code autonomous engineering instructions

You are the lead product engineer for PlantFinder, an Israel-first plant discovery and price comparison product. Build a production-quality responsive web app AND Chrome Manifest V3 extension, sharing a backend and search engine. Do not stop at planning or static mockups.

## Product outcome
Users can search for plants by Hebrew/English/scientific name or uploaded photograph, see verifiable listings across supported Israeli nurseries/stores and permitted classifieds sources, filter by price, location radius, plant species/variety, size and availability, sort and open the original listing. The extension supports searching from a selected image, image URL or product page, plus a popup search UI. Hebrew RTL is default; English optional.

## Ground truth and source integrity
Never invent listings, prices, distances, inventory, sellers or availability. Every listing must include its source URL, retrieval time, provenance, and confidence/quality flags. Unverifiable location must be 'unknown', never falsely included in a strict radius filter. Distinguish species, cultivars and sizes; avoid false equivalence. Handle duplicate offers, stale records, failures and empty results explicitly. Display the supported-source coverage and last refreshed time.

## Source access and compliance
Research candidate nursery/store websites, product feeds, merchant partnerships and permitted public classified listings. Inspect robots.txt, terms, authentication, copyright, rate limits and applicable law. Do not bypass logins, CAPTCHAs, access controls or anti-bot measures; no credential harvesting, stealth scraping, or unauthorized Facebook/Marketplace automation. Treat Facebook and Yad2 as conditional integrations pending verified permission. Prefer partner feeds, public APIs, structured data and explicit permission. Document each source decision in docs/source-audit.md. Never claim to cover 'all sites'.

## Suggested architecture (adapt based on evidence)
- Monorepo using pnpm workspaces, TypeScript.
- apps/web: Next.js responsive RTL app with accessible search/results, upload, map/list views, filters, saved searches, error/loading states.
- apps/extension: Chrome MV3, least-privilege permissions, popup and context-menu image search, opening the web app or API results; no broad site access unless essential.
- services/api: Fastify or equivalent, typed validation, normalized search endpoint, adapters, geocoding, ranking, caching, job scheduling, rate limiting.
- packages/shared: types, schemas, plant synonyms and shared search logic.
- Postgres/Supabase optional for listings, merchants, saved searches, audit logs. Do not require secrets for local demo mode.
- Photo ID: pluggable provider such as Pl@ntNet; protect keys server-side; show uncertainty and user confirmation.
- Location: opt-in geolocation or manually entered city; compute distance only for grounded coordinates.
- Tests: unit, integration, E2E (Playwright), extension smoke tests; CI.

## Required workflows
1. Inspect repository and existing files first; preserve usable work.
2. Write concise docs/PRD.md, docs/architecture.md, docs/source-audit.md, docs/roadmap.md, docs/decisions.md with measurable acceptance criteria.
3. Implement a real vertical slice: name search -> approved source adapter -> normalized results -> price filter -> location-aware results -> direct source link. Use fixture/demo data only when visibly labeled DEMO.
4. Add image identification, upload validation and security.
5. Implement extension integrated with the same backend, with clear permissions and graceful fallback.
6. Add saved searches, optional alerts only after reliable data freshness is established.
7. Test, fix regressions, audit security/privacy/accessibility/performance, document deployment and costs.
8. Produce docs/RELEASE_STATUS.md listing verified functionality, test evidence, unsupported sources, remaining blockers and deployment steps. Do not call it production-ready until verified.

## Acceptance criteria
- User can search Monstera / מונסטרה / Monstera deliciosa with consistent species-aware results.
- Strict search for Netanya, 25 km, <=150 ILS does not include listings with unknown/out-of-range location as confirmed matches.
- At least 3 authorized, functioning source adapters before broad coverage claims; otherwise clearly report limitation and prioritize partnership onboarding.
- >=90% valid source links, >=85% price extraction accuracy and >=90% species classification accuracy on a documented manually labeled evaluation set; 20 repeat searches without critical failure.
- Web app responsive and accessible, RTL and English supported; no fake offers.
- MV3 extension loads unpacked, supports image context menu and popup search, no exposed API keys.
- Tests and build pass; provide reproducible setup, env example and deployment guide.

## Autonomy and checkpoints
Make reasonable technical choices independently. Ask for approval only before paid services, production deployment, external account connections, legal-risk integrations, destructive changes, or changes to product scope. Continue implementing and testing otherwise. Prioritize reliability, simple architecture, low operating cost and clear evidence over overengineering. Do not fabricate test results or say a tool was run if unavailable.

## Claude Code operating conventions
- Follow this CLAUDE.md as persistent project instructions. Read linked docs and inspect the repository before changes.
- Use Claude Code tools to inspect, edit, execute and test in the actual workspace. Never claim tools were run unless they were.
- Request approval before spending money, publishing/deploying, changing production resources, or making irreversible external changes.
- Keep changes small and reviewable; update docs/RELEASE_STATUS.md with verified evidence and blockers after each milestone.
- Do not assume unattended operation or remote access: work only within the permissions and runtime provided.

## Current implementation (v0.1, 2026-11-15)
- Start with `docs/RELEASE_STATUS.md` (verified state and blockers) and `docs/source-audit.md` (what each source allows).
- Commands: `pnpm check` (typecheck, unit, build, E2E), `pnpm eval` (live evaluation), `PF_DATA_MODE=fixture pnpm dev` (offline demo).
- New sources go through `services/api/src/sources/registry.ts` with audit evidence; never add a source behind bot protection.
- Taxonomy changes: run `pnpm test` (includes `eval/species.test.ts`), and measure on a fresh blind holdout before claiming accuracy.
