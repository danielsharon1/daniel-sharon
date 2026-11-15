import { findPhrase, tokenize, type Listing } from "@plantfinder/shared";
import type { Transport } from "../http.js";
import type { SourceDef } from "../sources/registry.js";
import { buildListing, groupVariantsBySize, type AdapterResult, type SourceAdapter, type VariantLike } from "./common.js";

/** Subset of Shopify's public storefront /products.json schema. */
interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type: string;
  tags: string[] | string;
  variants: ShopifyVariant[];
  images: { src: string }[];
}

const PAGE_SIZE = 250;
const MAX_PAGES = 8;

function money(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function isProducts(x: unknown): x is { products: ShopifyProduct[] } {
  return !!x && typeof x === "object" && Array.isArray((x as { products?: unknown }).products);
}

/**
 * Shopify stores expose their public catalog as JSON. The full catalog is small (hundreds of
 * products), so it is fetched in a few pages, cached for hours, and searched locally.
 */
export class ShopifyAdapter implements SourceAdapter {
  constructor(
    readonly source: SourceDef,
    private readonly transport: Transport,
    private readonly policyPending: boolean
  ) {
    if (!source.apiBase) throw new Error(`Source ${source.id} has no apiBase`);
  }

  async search(terms: string[]): Promise<AdapterResult> {
    let requests = 0;
    let oldest: string | null = null;
    let allFromCache = true;
    let staleNote: string | null = null;
    const products: { p: ShopifyProduct; fetchedAt: string; endpoint: string }[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${this.source.apiBase}/products.json?limit=${PAGE_SIZE}&page=${page}`;
      const res = await this.transport.getJson(url);
      requests++;
      if (!oldest || res.fetchedAt < oldest) oldest = res.fetchedAt;
      if (!res.fromCache) allFromCache = false;
      if (res.staleFallback) staleNote = res.staleFallback;
      if (!isProducts(res.json)) throw new Error(`Unexpected products.json payload from ${this.source.id}`);
      for (const p of res.json.products) products.push({ p, fetchedAt: res.fetchedAt, endpoint: url });
      if (res.json.products.length < PAGE_SIZE) break;
    }

    const termTokens = terms.map((t) => tokenize(t)).filter((t) => t.length > 0);
    const demo = this.transport.kind === "fixture";
    const listings: Listing[] = [];
    for (const { p, fetchedAt, endpoint } of products) {
      const titleTokens = tokenize(p.title);
      if (!termTokens.some((tt) => findPhrase(titleTokens, tt) >= 0)) continue;
      const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      const categories = [p.product_type, ...tags].filter(Boolean);
      const image = p.images?.[0]?.src ?? null;
      const productUrl = `${this.source.apiBase}/products/${encodeURIComponent(p.handle)}`;
      const variants: VariantLike[] = p.variants.map((v) => {
        const label = [v.option1, v.option2, v.option3].filter((o) => o && o !== "Default Title").join(", ");
        return {
          id: String(v.id),
          label,
          price: money(v.price),
          regularPrice: money(v.compare_at_price),
          available: v.available ? "in_stock" : "out_of_stock",
          url: p.variants.length > 1 ? `${productUrl}?variant=${v.id}` : productUrl,
          imageUrl: image
        };
      });
      for (const g of groupVariantsBySize(p.title, variants)) {
        const l = buildListing(
          this.source,
          {
            title: p.title,
            url: g.url,
            imageUrl: g.imageUrl,
            variantId: g.label ? g.id : null,
            variantLabel: g.label || null,
            variantOptions: g.options,
            price: g.price,
            regularPrice: g.regularPrice,
            priceKind: g.priceKind,
            availability: g.available,
            categories
          },
          { method: demo ? "fixture" : "shopify-products-json", endpoint, retrievedAt: fetchedAt, demo },
          this.policyPending
        );
        if (l) listings.push(l);
      }
    }
    const result: AdapterResult = { listings, retrievedAt: oldest ?? new Date().toISOString(), fromCache: allFromCache, requests };
    if (staleNote) result.warning = `stale cache served: ${staleNote}`;
    return result;
  }
}
