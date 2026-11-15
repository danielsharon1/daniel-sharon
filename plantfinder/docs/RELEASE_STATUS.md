# Release status: v0.2 (2026-11-15)

## v0.2: free hosting (static site), not yet activated
| Item | Status | Evidence |
|---|---|---|
| Live full-catalog snapshot from all 6 sources | ✅ 5,091 plant listings, ~3 min, 337 KB encrypted | Local run of `pnpm --filter @plantfinder/api snapshot` (2026-11-15) |
| Benchmark on the snapshot = same buckets as the live API | ✅ 0 match / 5 unknown location / 10 outside radius | Script check + E2E (static project) |
| Encryption (AES-GCM, PBKDF2 400k); refuses unencrypted pilot data; tamper and wrong-passphrase detection | ✅ | Unit tests + E2E (ciphertext contains no catalog text) |
| Source failure → previous data carried over (≤72 h), labelled; no fresh source → job fails, site keeps last version | ✅ | Simulated with all sources unreachable |
| Static web app: unlock, remember, lock, search, photo (optional key), a11y, mobile | ✅ | 6 E2E tests (`e2e/static.spec.ts`) |
| Extension against the static site (bundled engine, local decryption) | ✅ | Extension E2E |
| Workflow `.github/workflows/plantfinder-site.yml` | ✅ written and rehearsed from a clean clone / ⚠️ **not yet run on GitHub** | Needs PR #1 merged into the default branch, Pages enabled, `PF_SNAPSHOT_PASSPHRASE` secret |
| CI workflow on GitHub (`plantfinder.yml`) | ✅ passed on GitHub | Runs #2 and #3 (2026-11-15), success |
| Photo identification in static mode | ⚠️ code only: no Pl@ntNet key available to test | — |

---

# Release status: v0.1 (2026-11-15)

**Status: working personal pilot. NOT production-ready for public launch.** The software is built and
tested end to end. The remaining blockers are permissions and owner actions, listed below.

## Verified functionality

| Area | Status | Evidence |
|---|---|---|
| Web app runs (Hebrew RTL default, English) | ✅ | E2E: i18n toggle, mobile no-overflow at 360 px; screenshots reviewed at desktop/mobile, light/dark |
| Name search, species-aware (Monstera = מונסטרה = Monstera deliciosa) | ✅ | API test (identical ids and buckets); E2E |
| Strict benchmark (Netanya / 25 km / ≤₪150) never confirms unknown or out-of-range sellers | ✅ | API test + E2E check every match label |
| 6 functioning source adapters (4 WooCommerce, 2 Shopify), live | ✅ | Live recording and `pnpm eval` 2026-11-15: all 6 `ok` |
| Sources **authorized in writing** | ❌ **0 of 6** | `source-audit.md`. Running under `personal` policy only |
| Filters: price, radius, size, seller type, stock, similar species; sorting | ✅ | API and E2E tests |
| Provenance on every offer (URL, check time, method, flags, DEMO label) | ✅ | Adapter tests on recorded data |
| Coverage panel with last-refreshed time and rejected sources | ✅ | E2E |
| Saved searches (this browser) | ✅ | E2E |
| Photo identification: upload validation, SSRF guard, candidates + confirmation | ✅ code / ⚠️ **provider untested** | API tests with a stub provider; no Pl@ntNet key available here |
| Chrome MV3 extension: loads, popup search, image/selection/page menus, no keys, no host permissions | ✅ | Extension E2E in Chromium (headless); build validator |
| Valid links ≥90% | ✅ 100% (48/48) | `pnpm eval` |
| Price extraction ≥85% | ✅ 100% (47/47) | `pnpm eval` |
| Species accuracy ≥90% on labelled set | ⚠️ **Not met blind**: 86.1% and 78.6% on two blind holdouts (98.3% / 92.4% / 87.5% after fixes, biased); unsafe errors ≤3.8% | `docs/evaluation.md` |
| 20 repeated searches, no critical failure | ✅ | API test (fixture) + live eval |
| Accessibility | ✅ automated | axe WCAG 2.1 A/AA: 0 serious/critical on 3 pages (manual screen-reader test not done) |
| Security review | ✅ done | `security-review.md`; `pnpm audit --prod`: no known vulnerabilities |
| Build, typecheck, tests | ✅ | `pnpm check`: 91 unit/integration + 16 E2E, all passing |
| CI | ✅ passed on GitHub (runs #2, #3) | `.github/workflows/plantfinder.yml` |
| Docker image | ✅ written / ⚠️ not built here (no Docker daemon) | Runtime layout reproduced with `pnpm deploy` and booted |
| Deployment | ❌ not deployed (needs owner approval) | `deployment.md` |

## Test evidence (latest run)
- `pnpm test`: 91 passed (shared engine 58, API 29 incl. adapters on recorded real data, evaluation guards 4)
- `pnpm test:e2e`: 16 passed (11 web incl. 3 axe audits, 5 extension)
- `pnpm eval` (live): links 48/48, prices 47/47, stability 20/20. Output `eval/results/live-2026-11-15T06-35-37-814Z.json`

## Unsupported sources
Facebook Marketplace and groups, and Yad2 (not authorized; no automation). PLANT IT, Azur Flowers and
Flowernet are behind Cloudflare bot challenges (not bypassed). גן ירק: robots.txt forbids its API. Wix
nurseries (e.g. משתלת הגנן) need a new adapter. Full list: `source-audit.md`.

## Remaining blockers (owner actions)
1. **Written permission from sources** (`partner-outreach.md` has a Hebrew template). Without it, keep the
   deployment private (`PF_SOURCE_POLICY=personal`).
2. **Pl@ntNet account and key** (`PLANTNET_API_KEY`) to enable and verify photo identification live.
3. **Approval to deploy** and choice of host (`deployment.md`; about $0–7/month).
4. **Chrome Web Store** developer account ($5) to publish the extension.
5. Optional: a horticulturist to review the taxonomy and labels, to reach ≥90% blind accuracy.

## Known limitations
- Coverage is 6 online sellers, **not all Israeli nurseries**. Chain stores and many local nurseries have no online catalog.
- Delivery coverage is shown as the seller's own text; "delivers to my city" is not computed.
- Distances for 3 sellers are locality-level (town centre), and flagged as such.
- No map view; no price alerts (deferred until freshness is proven).
- DNS-rebinding residual on URL-based photo identification (`security-review.md`).

## Commands
```bash
cd plantfinder
pnpm install
PF_DATA_MODE=fixture pnpm dev     # offline demo with recorded real data (web :5173, API :8787)
pnpm build && pnpm start          # production build, live sources, http://127.0.0.1:8787
pnpm check                        # typecheck + unit + build + E2E
pnpm eval                         # live link/price/stability evaluation (network to sources required)
```
