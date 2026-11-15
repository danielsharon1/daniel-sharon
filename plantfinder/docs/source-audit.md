# Source audit

Last checked: **2026-11-14/15**. Method for each candidate: search results → `robots.txt` → platform and
public endpoint → terms of use (תקנון) → physical location and delivery pages. No login, CAPTCHA, bot
challenge or access control was bypassed, and none will be. Machine-readable version:
`services/api/src/sources/registry.ts` (shown in the app under "מקורות").

## Status definitions

| Status | Meaning | Used when |
|---|---|---|
| `partner` | Written permission or feed agreement on file | Always (none yet) |
| `pilot` | Public structured endpoint, allowed by robots.txt, no anti-bot bypass; **terms restrict reuse or are silent** | Only with `PF_SOURCE_POLICY=personal` (private use) |
| `pending` | Possible, but not implemented or not reviewed | Never |
| `rejected` | Bot protection, robots.txt or terms forbid access | Never |

`PF_SOURCE_POLICY=public` enables only `partner` sources. As of today that is **zero sources**, which is why
the main business blocker is permission, not engineering (see `partner-outreach.md`).

## Integrated sources (pilot)

| Source | Platform / method | robots.txt | Terms of use | Seller location (evidence) | Delivery |
|---|---|---|---|---|---|
| **המשתלה (בונסאי שופ)** hamashtela.co.il | WooCommerce Store API `/wp-json/wc/store/v1/products?search=` | Allows `/wp-json/` (disallows only `/wp-admin/`, add-to-cart, WC upload dirs) | `/terms` (2023-03-05): no copying or automated-access clause found | Moshav Giv'at Hen, **address precision**: coordinates from the Google Maps embed on the directions page | Netanya–Ashkelon, min. ₪150; pickup by appointment |
| **הגן הקסום של נקודת חן** gankasumnh.co.il | WooCommerce Store API | Allows `/wp-json/` | Only shipping terms published; no reuse clause found | Kfar Ma'as junction (About page), **locality precision** via GeoNames 294401 | Gush Dan / centre per shipping terms |
| **משתלת מרמלשטיין** mermel-nursery.co.il | WooCommerce Store API | `Allow: /`; `Content-Signal: search=yes, ai-input=yes, ai-train=no` | IP clause: no copying/republishing without permission | הגפן 5 גני טל (terms), **locality precision** via GeoNames 11979647 | Selected areas (Gedera, Rehovot, Ashdod, Rishon…) |
| **נטע** netaplants.co.il | WooCommerce Store API | Allows all, incl. named AI agents; `Content-Signal: search=yes, ai-input=yes` | §7: personal use only; no copying, public display or commercial use without prior written permission | **None published** (online store) → `location_unknown` | ₪30, free over ₪290 |
| **רוטין** rootine.co.il | Shopify public catalog `/products.json` (cached 6 h) | Shopify default; `agents.md` asks agents to identify themselves; server-to-server agents should use Web Bot Auth | §1.3/§14: no copying or use of content without prior written permission | Offices in Rishon LeZion, no walk-in (contact page), **locality precision** | Home delivery |
| **GRDN** grdntlv.co.il | Shopify `/products.json` | Shopify default + `agents.md` | Personal use only; no copying, public display or commercial use without written permission | **None published** → `location_unknown` | Gush Dan and Sharon city list (Netanya not listed) |

Why these endpoints: both are **official, public, unauthenticated** catalog interfaces that the platforms
publish for storefront use. They put far less load on the sites than HTML scraping, and they give exact
prices, stock and variant data.

Access behaviour (enforced in `services/api/src/http.ts`):
- A stable, honest User-Agent (`PlantFinderBot/0.1 …`), never a spoofed browser.
- robots.txt is fetched (24 h cache) and checked before every request.
- One request at a time per host, at least 0.7 s apart (1.2 s for bulk recording), and at most 12 queued requests per host.
- Bot challenges, 403 and 429 responses open a circuit for 30–60 minutes. **There is no retry and no workaround.**
- Results are cached (Woo search: 30 min; Shopify catalog: 6 h). A failing source serves a clearly labelled
  stale copy for up to 72 h, or nothing.
- Images are hot-linked from the source, never copied or stored.

## Rejected or not integrated

| Candidate | Finding | Decision |
|---|---|---|
| PLANT IT (plantit.co.il) | Cloudflare bot challenge on every request, including robots.txt | **Rejected**: will not bypass |
| Azur Flowers (azurflowers.co.il) | Cloudflare bot challenge | **Rejected** |
| Flowernet (flowernet.co.il) | Cloudflare bot challenge | **Rejected** |
| גן ירק (gan-yarak.co.il) | robots.txt disallows `/wp-` (incl. REST API) and search pages | **Rejected** for the API; product pages are allowed, so a sitemap-based crawler is possible later, with permission |
| עץ השדה (etshasadeh.co.il) | Connection reset during the audit; delivers only to the north | Not integrated |
| Venatata farm | Host unreachable (502) | Not integrated |
| משתלת הגנן (hagananplants.co.il) | Wix: no public catalog API; robots allows crawling | **Pending**: needs a per-page JSON-LD crawler from the sitemap |
| משתלת הדר נוי (hadarnoy.co.il) | Custom site on Vercel; no structured endpoint identified | **Pending** |
| **Facebook Marketplace / groups** | No authorized API for Marketplace listings; terms prohibit automated collection; login required | **Rejected**: no automation. Only possible through an official partnership |
| **Yad2** | Terms prohibit automated collection; bot protection | **Rejected** until written permission or a partnership |

## Supporting services

| Service | Use | Terms / cost | Status |
|---|---|---|---|
| Pl@ntNet API (my-api.plantnet.org) | Photo identification, server-side only | Free tier for registered users (≈500 identifications/day, per their site, to be re-checked at signup); key required | **Implemented, untested live**: no key in this environment. Needs Daniel to create an account |
| GeoNames IL extract | Israeli localities with Hebrew names and coordinates (1,151 places) | CC BY 4.0; attribution shown in the footer | Bundled; rebuild with `pnpm gazetteer` |

## Legal reading (not legal advice)

- Prices and availability are facts. Titles, descriptions and photos are the store's copyright-protected content.
- Four of six pilot sources explicitly forbid copying or commercial use without written permission. Using them in
  a **private, personal search tool** with links back is defensible. A **public or commercial** product built on
  them is not, without permission.
- Before any public launch: get written permission per source (template in `partner-outreach.md`), confirm
  image display rights, and get a short review by an Israeli lawyer covering copyright and database rights.
  Also confirm the privacy-policy obligations under the Protection of Privacy Law and its amendment 13 if
  accounts are added later.
