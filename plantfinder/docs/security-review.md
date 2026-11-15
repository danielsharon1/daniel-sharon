# Security, privacy and compliance review (v0.1, 2026-11-15)

Scope: `services/api`, `apps/web`, `apps/extension`, `packages/shared`. This review was done by the
implementing engineer; an independent review is recommended before any public launch.

## Findings and controls

| Area | Risk | Control | Evidence |
|---|---|---|---|
| Secrets | Provider key leaking to clients | `PLANTNET_API_KEY` is read server-side only. The extension has no keys, and the build fails if a key pattern appears | `apps/extension/build.mjs`; extension E2E |
| SSRF (`/api/identify` with `imageUrl`) | Server fetching internal addresses | http(s) only; ports 80 and 443 only; no credentials in the URL; localhost, `.local` and `.internal` hosts blocked; DNS resolved and **all** addresses checked against private, loopback, link-local, CGNAT, multicast and documentation ranges (v4 and v6, incl. v4-mapped); redirects re-checked (max 3); 10 s timeout; 6 MB streaming cap; image type sniffed from bytes | `net-guard.ts`, `identify.ts`; API tests |
| SSRF residual | DNS rebinding between the check and the connect | Accepted for v0.1 and documented. Fix: pin the resolved IP in a custom agent, or disable URL identification in public mode | — |
| Uploads | Malicious files (SVG/HTML posing as images) | Type is decided by magic bytes (JPEG, PNG, WebP), not by the declared type; 6 MB limit; one file; processed in memory and never stored | API tests (SVG rejected, 415) |
| XSS | Source titles rendered in the page | React escapes text; no `dangerouslySetInnerHTML`; the extension builds DOM with `textContent` only (the build fails on `innerHTML=`, `eval`, `new Function`); links and images are https-only, which blocks `javascript:` | `buildListing` (`safeHttpsUrl`), extension build validator |
| CSP | Script injection | `default-src 'self'; script-src 'self'`; fonts self-hosted (no `data:`), `frame-ancestors 'none'`, `object-src 'none'`; extension pages `script-src 'self'` | Response headers; Vite `assetsInlineLimit: 0` |
| Headers | Clickjacking, MIME sniffing | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` | API test |
| CORS | Other sites using the API from a browser | Only configured origins. The default allows `chrome-extension://*`; **in production pin the published extension id** | API test (evil origin refused) |
| Abuse / DoS | Flooding search → load on nurseries | 40 searches/min/IP and 10 identifications/min/IP; per-host request queue capped at 12; per-source 25 s timeout; in-flight request de-duplication; response cache | API tests |
| Source protection | Bypassing bot defences | Stable honest User-Agent; robots.txt enforced; challenge, 403 or 429 opens a circuit with no retry; https only; responses capped at 8 MB | `http.ts`; tests |
| Input validation | Malformed queries | zod schemas; bounded lengths and numbers; unknown city → 400; non-Israel coordinates → 400 | API tests |
| Errors | Leaking internals | JSON error codes only; no stack traces; 5xx logged without request data | `app.ts` |
| Dependencies | Known CVEs | `pnpm audit --prod`: **no known vulnerabilities** (2026-11-15) | — |
| Container | Running as root | Runtime image runs as `node`; only `/data` is writable | `Dockerfile` |

## Privacy
- **No accounts and no server-side storage of searches.** Saved searches stay in the user's browser (localStorage).
- Request logging is disabled, because URLs contain the search and possibly coordinates. Only startup and
  5xx errors are logged.
- Browser geolocation is opt-in. Coordinates are coarsened to about 1 km on the client and again on the server, and are never stored.
- Photos are sent to Pl@ntNet for identification and not kept by PlantFinder. Pl@ntNet's own terms apply
  and must be linked in a privacy notice before public launch.
- The extension sends only what the user explicitly asks to search: selected text, the page title (via
  `activeTab`, after a user gesture) or an image URL. It has no host permissions and no content scripts, and
  never reads page content.

## Compliance status (see `source-audit.md`)
- Six sources are integrated under **personal pilot** policy. Four have terms that forbid commercial reuse
  without written permission. **Do not expose a `personal` deployment publicly.** Public mode enables only
  sources with written permission, which today means none.
- Facebook and Yad2 are not integrated.
- GeoNames attribution (CC BY 4.0) is shown in the footer.

## Open items before a public launch
1. Written permissions from sources (or switch the policy to `public` and onboard partners).
2. Pin the extension id in `PF_ALLOWED_ORIGINS`; set `PF_TRUST_PROXY=1` behind a reverse proxy so rate limits see real client IPs.
3. Fix the DNS-rebinding residual, or disable URL identification.
4. Privacy notice (Hebrew and English) covering Pl@ntNet and geolocation; legal review.
5. Independent security review and dependency monitoring (Dependabot or Renovate).
