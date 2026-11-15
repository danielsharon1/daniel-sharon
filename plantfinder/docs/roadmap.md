# Roadmap

## Done (v0.1, 2026-11-15)
1. ✅ Source audit: 6 functioning adapters (WooCommerce ×4, Shopify ×2), 8 candidates documented as rejected or pending.
2. ✅ API, normalisation, provenance, taxonomy-aware name search, strict location and price filters.
3. ✅ Responsive Hebrew RTL and English web app with coverage panel, saved searches, distance ruler.
4. ✅ Photo identification (Pl@ntNet, server-side), upload validation, SSRF guard. **Live provider untested (no key).**
5. ✅ Chrome MV3 extension: popup, image, selection and page context menus.
6. ✅ Tests: 91 unit and integration, 16 E2E (incl. axe and extension), labelled evaluation, live link and price checks.
7. ✅ Security review, Docker and CI, deployment guide.

## Next, by value
1. **Permissions (owner action, the main blocker).** Send the outreach email (`partner-outreach.md`) to the 6
   pilot sources and to larger nurseries. Record the answers in the registry (`status: partner`).
2. **Pl@ntNet key (owner action).** Create an account and set `PLANTNET_API_KEY`, then run the live photo test.
3. **Coverage.** Add a Wix/JSON-LD sitemap adapter (for משתלת הגנן and similar) only for sources that grant permission. Add more WooCommerce/Shopify nurseries found in a broader search.
4. **Classification.** Expand cultivar lists (Syngonium, Hoya, Aglaonema, Philodendron) and have a horticulturist review the labels. Re-measure on a fresh holdout.
5. **Freshness monitoring.** A scheduled job that records per-source success, latency and freshness. Alerts follow once it has been stable for 2–4 weeks.
6. **Delivery-to-my-city.** Structured delivery zones per source, as a separate "delivers to you" bucket.
7. **Map view.** Needs a tile provider decision (cost and privacy).
8. **Web Bot Auth** signing for Shopify sources, per their agents.md.
9. **Accounts** (optional) for cross-device saved searches; needs a privacy policy.
