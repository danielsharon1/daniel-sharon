import type { Availability, Listing } from "@plantfinder/shared";
import type { Transport } from "../http.js";
import type { SourceDef } from "../sources/registry.js";
import { buildListing, groupVariantsBySize, type AdapterResult, type SourceAdapter, type VariantLike } from "./common.js";

/** Subset of the WooCommerce Store API (wc/store/v1) product schema that we rely on. */
interface WooPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_minor_unit: number;
  price_range: { min_amount: string; max_amount: string } | null;
}
interface WooProduct {
  id: number;
  parent?: number;
  name: string;
  type: string;
  permalink: string;
  variation?: string;
  prices: WooPrices;
  is_in_stock: boolean;
  is_purchasable?: boolean;
  images?: { src: string; thumbnail?: string }[];
  categories?: { name: string }[];
}

const PER_PAGE = 50;
const MAX_PAGES = 2;

function toMajor(minor: string | undefined, unit: number): number | null {
  if (minor === undefined || minor === null || minor === "") return null;
  const n = Number(minor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((n / 10 ** unit) * 100) / 100;
}

function isWooProductArray(x: unknown): x is WooProduct[] {
  return Array.isArray(x) && x.every((p) => p && typeof p === "object" && "id" in p && "prices" in p && "permalink" in p);
}

export class WooCommerceAdapter implements SourceAdapter {
  constructor(
    readonly source: SourceDef,
    private readonly transport: Transport,
    private readonly policyPending: boolean
  ) {
    if (!source.apiBase) throw new Error(`Source ${source.id} has no apiBase`);
  }

  private productsUrl(params: [string, string][]): string {
    const base = `${this.source.apiBase}/wp-json/wc/store/v1/products`;
    const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    return `${base}?${qs}`;
  }

  async search(terms: string[]): Promise<AdapterResult> {
    let requests = 0;
    let oldest: string | null = null;
    let allFromCache = true;
    let staleNote: string | null = null;
    const track = (r: { fetchedAt: string; fromCache?: boolean; staleFallback?: string }) => {
      requests++;
      if (!oldest || r.fetchedAt < oldest) oldest = r.fetchedAt;
      if (!r.fromCache) allFromCache = false;
      if (r.staleFallback) staleNote = r.staleFallback;
    };

    const products = new Map<number, { p: WooProduct; fetchedAt: string; endpoint: string }>();
    for (const term of terms) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = this.productsUrl([
          ["per_page", String(PER_PAGE)],
          ["page", String(page)],
          ["search", term]
        ]);
        const res = await this.transport.getJson(url);
        track(res);
        if (!isWooProductArray(res.json)) throw new Error(`Unexpected Store API payload from ${this.source.id}`);
        for (const p of res.json) if (!products.has(p.id)) products.set(p.id, { p, fetchedAt: res.fetchedAt, endpoint: url });
        if (res.json.length < PER_PAGE) break;
      }
    }

    // Variation prices for variable products (one request per 20 parents).
    const variableIds = [...products.values()].filter((x) => x.p.type === "variable").map((x) => x.p.id).sort((a, b) => a - b);
    const variations = new Map<number, { v: WooProduct; fetchedAt: string; endpoint: string }[]>();
    const variationErrors = new Set<number>();
    for (let i = 0; i < variableIds.length; i += 20) {
      const chunk = variableIds.slice(i, i + 20);
      const url = this.productsUrl([
        ["per_page", "100"],
        ["type", "variation"],
        ...chunk.map((id): [string, string] => ["parent[]", String(id)])
      ]);
      try {
        const res = await this.transport.getJson(url);
        track(res);
        if (!isWooProductArray(res.json)) throw new Error("bad variation payload");
        for (const v of res.json) {
          const parent = v.parent ?? 0;
          variations.set(parent, [...(variations.get(parent) ?? []), { v, fetchedAt: res.fetchedAt, endpoint: url }]);
        }
      } catch {
        chunk.forEach((id) => variationErrors.add(id));
      }
    }

    const demo = this.transport.kind === "fixture";
    const listings: Listing[] = [];
    for (const { p, fetchedAt, endpoint } of products.values()) {
      const unit = p.prices.currency_minor_unit ?? 0;
      if (p.prices.currency_code && p.prices.currency_code !== "ILS") continue;
      const categories = (p.categories ?? []).map((c) => c.name);
      const image = p.images?.[0]?.thumbnail || p.images?.[0]?.src || null;
      const availability: Availability = p.is_in_stock ? "in_stock" : "out_of_stock";

      const vars = p.type === "variable" ? variations.get(p.id) ?? [] : [];
      if (p.type === "variable" && vars.length > 0) {
        const vl: VariantLike[] = vars.map(({ v }) => ({
          id: String(v.id),
          label: v.variation ?? "",
          price: toMajor(v.prices.price, v.prices.currency_minor_unit ?? unit),
          regularPrice: toMajor(v.prices.regular_price, v.prices.currency_minor_unit ?? unit),
          available: v.is_in_stock ? "in_stock" : "out_of_stock",
          url: v.permalink || p.permalink,
          imageUrl: v.images?.[0]?.thumbnail || v.images?.[0]?.src || image
        }));
        const varFetchedAt = vars[0]!.fetchedAt;
        for (const g of groupVariantsBySize(p.name, vl)) {
          const l = buildListing(
            this.source,
            {
              title: p.name,
              url: g.url,
              imageUrl: g.imageUrl,
              variantId: g.id,
              variantLabel: g.label || null,
              variantOptions: g.options,
              price: g.price,
              regularPrice: g.regularPrice,
              priceKind: g.priceKind,
              availability: g.available,
              categories
            },
            { method: demo ? "fixture" : "woocommerce-store-api", endpoint: vars[0]!.endpoint, retrievedAt: varFetchedAt < fetchedAt ? varFetchedAt : fetchedAt, demo },
            this.policyPending
          );
          if (l) listings.push(l);
        }
        continue;
      }

      // Simple product, or variable product whose variations could not be loaded (price range "from").
      const range = p.prices.price_range;
      const fromRange = p.type === "variable" && range;
      const price = fromRange ? toMajor(range.min_amount, unit) : toMajor(p.prices.price, unit);
      const regular = fromRange ? null : toMajor(p.prices.regular_price, unit);
      const l = buildListing(
        this.source,
        {
          title: p.name,
          url: p.permalink,
          imageUrl: image,
          variantId: null,
          variantLabel: null,
          price,
          regularPrice: regular,
          priceKind: fromRange && range.min_amount !== range.max_amount ? "from" : price === null ? "unknown" : "fixed",
          availability,
          categories
        },
        { method: demo ? "fixture" : "woocommerce-store-api", endpoint, retrievedAt: fetchedAt, demo },
        this.policyPending
      );
      if (l) listings.push(l);
    }

    const result: AdapterResult = {
      listings,
      retrievedAt: oldest ?? new Date().toISOString(),
      fromCache: requests > 0 && allFromCache,
      requests
    };
    if (staleNote) result.warning = `stale cache served: ${staleNote}`;
    else if (variationErrors.size) result.warning = `variant prices unavailable for ${variationErrors.size} products (showing price ranges)`;
    return result;
  }
}
