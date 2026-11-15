import {
  evaluateListings,
  resolveQuery,
  type Listing,
  type SearchRequest,
  type SearchResponse,
  type SourcePublicInfo,
  type SourceRunStatus
} from "@plantfinder/shared";
import { BlockedError, type Transport } from "./http.js";
import type { CachingTransport } from "./cache.js";
import { SOURCES, type SourceDef } from "./sources/registry.js";
import type { SourceAdapter } from "./adapters/common.js";
import { WooCommerceAdapter } from "./adapters/woocommerce.js";
import { ShopifyAdapter } from "./adapters/shopify.js";

export interface SearchServiceOptions {
  transport: Transport;
  sourcePolicy: "personal" | "public";
  sources?: SourceDef[];
  perSourceTimeoutMs?: number;
}

export function isEnabled(source: SourceDef, policy: "personal" | "public"): { enabled: boolean; reason: string | null } {
  if (source.status === "rejected") return { enabled: false, reason: source.note ?? "rejected" };
  if (source.status === "pending") return { enabled: false, reason: source.note ?? "pending review" };
  if (policy === "public" && source.status !== "partner") return { enabled: false, reason: "no written permission on file (public policy)" };
  if (source.platform !== "woocommerce" && source.platform !== "shopify") return { enabled: false, reason: "no adapter" };
  return { enabled: true, reason: null };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export class SearchService {
  readonly adapters: SourceAdapter[];
  private readonly sources: SourceDef[];

  constructor(private readonly opts: SearchServiceOptions) {
    this.sources = opts.sources ?? SOURCES;
    this.adapters = this.sources
      .filter((s) => isEnabled(s, opts.sourcePolicy).enabled)
      .map((s) => {
        const pending = s.status !== "partner";
        return s.platform === "shopify" ? new ShopifyAdapter(s, opts.transport, pending) : new WooCommerceAdapter(s, opts.transport, pending);
      });
  }

  get dataMode(): "live" | "fixture" {
    return this.opts.transport.kind;
  }

  sourcesInfo(): SourcePublicInfo[] {
    const cache = this.opts.transport as Partial<CachingTransport>;
    return this.sources.map((s) => {
      const { enabled, reason } = isEnabled(s, this.opts.sourcePolicy);
      return {
        id: s.id,
        name: s.name,
        homepage: s.homepage,
        platform: s.platform,
        status: s.status,
        enabled,
        disabledReason: reason,
        seller: s.seller,
        audit: s.audit,
        lastRefreshedAt: s.apiBase && typeof cache.lastFetchedAt === "function" ? cache.lastFetchedAt.call(this.opts.transport, s.apiBase) : null
      };
    });
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const { resolved, target } = resolveQuery(request.q);
    const statuses: SourceRunStatus[] = [];
    const listings: Listing[] = [];

    if (resolved.sourceTerms.length > 0) {
      const runs = await Promise.all(
        this.adapters.map(async (adapter): Promise<SourceRunStatus> => {
          const started = Date.now();
          try {
            const r = await withTimeout(adapter.search(resolved.sourceTerms), this.opts.perSourceTimeoutMs ?? 25_000);
            listings.push(...r.listings);
            return {
              sourceId: adapter.source.id,
              status: "ok",
              message: r.warning ?? null,
              fetched: r.listings.length,
              durationMs: Date.now() - started,
              retrievedAt: r.retrievedAt,
              fromCache: r.fromCache
            };
          } catch (e) {
            return {
              sourceId: adapter.source.id,
              status: e instanceof BlockedError ? "blocked" : "error",
              message: e instanceof Error ? e.message : String(e),
              fetched: 0,
              durationMs: Date.now() - started,
              retrievedAt: null,
              fromCache: false
            };
          }
        })
      );
      statuses.push(...runs);
    }
    for (const s of this.sources) {
      if (!isEnabled(s, this.opts.sourcePolicy).enabled) {
        statuses.push({ sourceId: s.id, status: "skipped", message: isEnabled(s, this.opts.sourcePolicy).reason, fetched: 0, durationMs: 0, retrievedAt: null, fromCache: false });
      }
    }

    // Stable input order (by source id, then title) so repeated searches are deterministic.
    listings.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.title.localeCompare(b.title) || a.url.localeCompare(b.url));
    const { items, counts, hidden } = evaluateListings(listings, request, target);
    return {
      query: resolved,
      request,
      items,
      counts,
      hidden,
      sources: statuses,
      dataMode: this.dataMode,
      sourcePolicy: this.opts.sourcePolicy,
      generatedAt: new Date().toISOString()
    };
  }
}
