/**
 * Live evaluation against the real sources (needs outbound access to the source hosts):
 *   NODE_USE_ENV_PROXY=1 pnpm eval            (root script)
 *
 * 1. Runs real searches through the production adapters.
 * 2. Samples listings per source and fetches each listing's product page (robots-checked, throttled).
 * 3. Link validity: the page answers 200 and is a product page.
 * 4. Price accuracy: our extracted price vs an independent value on the page itself —
 *    WooCommerce per-variation data (data-product_variations) or schema.org JSON-LD offers.
 * 5. Stability: the benchmark search repeated 20 times.
 * Writes eval/results/live-<timestamp>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeEntities, type Listing } from "../packages/shared/src/index.js";
import { LiveTransport } from "../services/api/src/http.js";
import { CachingTransport } from "../services/api/src/cache.js";
import { SearchService } from "../services/api/src/search-service.js";
import { parseRobots } from "../services/api/src/robots.js";
import { loadConfig } from "../services/api/src/config.js";

const config = loadConfig();
const UA = config.userAgent;
const QUERIES = ["Monstera", "פוטוס", "סנסוויריה", "פיקוס כינורי", "זמיוקולקס", "קלתאה"];
const PER_SOURCE = 8;

const transport = new CachingTransport(new LiveTransport({ userAgent: UA, minIntervalMs: 1200 }), { ttlMsFor: () => 3600_000, maxStaleMs: 0 });
const service = new SearchService({ transport, sourcePolicy: "personal" });
const base = { location: null, radiusKm: null, maxPrice: null, minPrice: null, inStockOnly: false, includeRelated: true, sizes: [], sellerTypes: [], sort: "price" as const, lang: "he" as const };

// ---- 1. collect live listings ------------------------------------------------------------------
const all = new Map<string, Listing>();
for (const q of QUERIES) {
  const r = await service.search({ q, ...base });
  for (const i of r.items) all.set(i.id, i);
  const bad = r.sources.filter((s) => s.status === "error" || s.status === "blocked");
  console.log(`search ${q}: ${r.items.length} items${bad.length ? `, source problems: ${bad.map((b) => `${b.sourceId}(${b.message})`).join(" ")}` : ""}`);
}

// ---- 2. deterministic stratified sample ---------------------------------------------------------
const bySource = new Map<string, Listing[]>();
for (const l of all.values()) bySource.set(l.sourceId, [...(bySource.get(l.sourceId) ?? []), l]);
const sample: Listing[] = [];
for (const [, ls] of [...bySource.entries()].sort()) {
  ls.sort((a, b) => a.id.localeCompare(b.id));
  const step = Math.max(1, Math.floor(ls.length / PER_SOURCE));
  for (let i = 0; i < ls.length && sample.filter((s) => s.sourceId === ls[0]!.sourceId).length < PER_SOURCE; i += step) sample.push(ls[i]!);
}

// ---- 3/4. fetch product pages politely ----------------------------------------------------------
const robotsCache = new Map<string, ReturnType<typeof parseRobots>>();
async function allowed(url: URL): Promise<boolean> {
  if (!robotsCache.has(url.host)) {
    const res = await fetch(new URL("/robots.txt", url), { headers: { "user-agent": UA } });
    robotsCache.set(url.host, res.ok ? parseRobots(await res.text(), UA) : { isAllowed: () => res.status < 500 });
  }
  return robotsCache.get(url.host)!.isAllowed(url.pathname + url.search);
}

type Offer = { price: number; url?: string };
function jsonLdOffers(html: string): Offer[] {
  const out: Offer[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const o = node as Record<string, unknown>;
    const type = o["@type"];
    if (type === "Offer" || (Array.isArray(type) && type.includes("Offer"))) {
      const p = Number(o.price ?? (o.priceSpecification as Record<string, unknown> | undefined)?.price);
      if (Number.isFinite(p) && p > 0) out.push({ price: p, url: typeof o.url === "string" ? o.url : undefined });
    }
    if (type === "AggregateOffer") {
      const lo = Number(o.lowPrice);
      if (Number.isFinite(lo) && lo > 0) out.push({ price: lo });
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1]!));
    } catch {
      /* ignore malformed blocks */
    }
  }
  return out;
}

function wooVariations(html: string): { variation_id: number; display_price: number }[] {
  const m = /data-product_variations=["']([^"']*)["']/.exec(html);
  if (!m) return [];
  try {
    const data = JSON.parse(decodeEntities(m[1]!)) as unknown;
    return Array.isArray(data) ? (data as { variation_id: number; display_price: number }[]) : [];
  } catch {
    return [];
  }
}

interface Check {
  sourceId: string;
  title: string;
  variant: string | null;
  url: string;
  status: number | null;
  linkValid: boolean;
  ours: number | null;
  truth: number | null;
  truthMethod: string | null;
  priceMatch: boolean | null;
  note?: string;
}

const lastHit = new Map<string, number>();
async function politeGet(url: URL): Promise<Response> {
  const wait = (lastHit.get(url.host) ?? 0) + 1500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(url.host, Date.now());
  return fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
}

async function check(l: Listing): Promise<Check> {
  const url = new URL(l.url);
  const base: Check = { sourceId: l.sourceId, title: l.title, variant: l.variant?.label ?? null, url: l.url, status: null, linkValid: false, ours: l.price.amount, truth: null, truthMethod: null, priceMatch: null };
  if (!(await allowed(url))) return { ...base, note: "robots.txt disallows the product page; not fetched" };
  let res: Response;
  try {
    res = await politeGet(url);
  } catch (e) {
    return { ...base, note: `fetch failed: ${(e as Error).message}` };
  }
  const html = await res.text();
  const isProduct = /"@type"\s*:\s*"Product"|og:type"\s+content="product|product_variations|class="[^"]*\bproduct\b/i.test(html);
  const out: Check = { ...base, status: res.status, linkValid: res.ok && isProduct };
  if (!out.linkValid) return { ...out, note: res.ok ? "not recognised as a product page" : `HTTP ${res.status}` };

  // Independent price on the page
  const vars = wooVariations(html);
  if (l.variant && vars.length) {
    const v = vars.find((x) => String(x.variation_id) === l.variant!.id);
    if (v) {
      out.truth = Number(v.display_price);
      out.truthMethod = "woo data-product_variations";
    }
  }
  if (out.truth === null) {
    const offers = jsonLdOffers(html);
    const byVariant = l.variant ? offers.find((o) => o.url?.includes(`variant=${l.variant!.id}`)) : undefined;
    const chosen = byVariant ?? (offers.length ? offers.reduce((a, b) => (b.price < a.price ? b : a)) : undefined);
    if (chosen) {
      out.truth = chosen.price;
      out.truthMethod = byVariant ? "json-ld offer (variant url)" : l.price.kind === "from" ? "json-ld lowest offer" : "json-ld offer";
      if (!byVariant && l.variant && offers.length > 1 && !offers.some((o) => Math.abs(o.price - (l.price.amount ?? -1)) < 0.01)) {
        out.note = "variant not identifiable in JSON-LD";
      } else if (!byVariant && l.variant && offers.some((o) => Math.abs(o.price - (l.price.amount ?? -1)) < 0.01)) {
        out.truth = l.price.amount; // our price equals one of the page's offers
        out.truthMethod = "json-ld offer list contains our price";
      }
    }
  }
  if (out.truth !== null && out.ours !== null) out.priceMatch = Math.abs(out.truth - out.ours) < 0.01;
  return out;
}

const bySourceQueue = new Map<string, Listing[]>();
for (const l of sample) bySourceQueue.set(l.sourceId, [...(bySourceQueue.get(l.sourceId) ?? []), l]);
const checks: Check[] = (await Promise.all([...bySourceQueue.values()].map(async (ls) => {
  const res: Check[] = [];
  for (const l of ls) res.push(await check(l));
  return res;
}))).flat();

// ---- 5. stability: 20 repeated benchmark searches -----------------------------------------------
let critical = 0;
let sourceIssues = 0;
for (let i = 0; i < 20; i++) {
  try {
    const r = await service.search({ ...base, q: "Monstera", location: { lat: 32.33294, lon: 34.85917, label: "נתניה" }, radiusKm: 25, maxPrice: 150, inStockOnly: true });
    sourceIssues += r.sources.filter((s) => s.status === "error" || s.status === "blocked").length;
    if (r.items.some((x) => x.bucket === "match" && (x.seller.location === null || (x.distanceKm ?? 999) > 25))) critical++;
  } catch {
    critical++;
  }
}

// ---- report -------------------------------------------------------------------------------------
const fetched = checks.filter((c) => c.status !== null);
const priceChecked = checks.filter((c) => c.priceMatch !== null);
const summary = {
  ranAt: new Date().toISOString(),
  queries: QUERIES,
  listingsCollected: all.size,
  sampled: checks.length,
  linkValidity: { valid: checks.filter((c) => c.linkValid).length, of: checks.length, rate: +(checks.filter((c) => c.linkValid).length / checks.length).toFixed(3), notFetched: checks.length - fetched.length },
  priceAccuracy: {
    matches: priceChecked.filter((c) => c.priceMatch).length,
    of: priceChecked.length,
    rate: priceChecked.length ? +(priceChecked.filter((c) => c.priceMatch).length / priceChecked.length).toFixed(3) : null,
    notCheckable: checks.length - priceChecked.length
  },
  stability: { repeats: 20, criticalFailures: critical, sourceErrorsAcrossRepeats: sourceIssues },
  perSource: Object.fromEntries(
    [...new Set(checks.map((c) => c.sourceId))].map((s) => {
      const cs = checks.filter((c) => c.sourceId === s);
      return [s, { sampled: cs.length, linksValid: cs.filter((c) => c.linkValid).length, pricesChecked: cs.filter((c) => c.priceMatch !== null).length, pricesMatched: cs.filter((c) => c.priceMatch).length }];
    })
  )
};
const dir = join(new URL(".", import.meta.url).pathname, "results");
mkdirSync(dir, { recursive: true });
const file = join(dir, `live-${summary.ranAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ summary, checks }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const c of checks.filter((c) => !c.linkValid || c.priceMatch === false || c.priceMatch === null)) console.log("  ·", c.sourceId, c.title, c.variant ?? "", "|", c.note ?? `ours ${c.ours} vs page ${c.truth} (${c.truthMethod})`);
console.log(`written ${file}`);
