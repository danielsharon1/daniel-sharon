import { join } from "node:path";
import type { Config } from "./config.js";
import { CachingTransport } from "./cache.js";
import { FixtureTransport } from "./fixture-transport.js";
import { LiveTransport, type Transport } from "./http.js";
import { SearchService } from "./search-service.js";
import { PlantNetProvider, type IdentifyProvider } from "./identify.js";

export function ttlFor(url: string): number {
  if (url.includes("/products.json")) return 6 * 3600_000; // Shopify full catalog
  return 30 * 60_000; // per-term Store API search
}

export function createTransport(config: Config): Transport {
  if (config.dataMode === "fixture") return new FixtureTransport(config.fixturesDir);
  return new CachingTransport(new LiveTransport({ userAgent: config.userAgent }), {
    ttlMsFor: ttlFor,
    maxStaleMs: 72 * 3600_000,
    persistPath: join(config.dataDir, "http-cache.json")
  });
}

export function createRuntime(config: Config): { search: SearchService; identify: IdentifyProvider | null } {
  return {
    search: new SearchService({ transport: createTransport(config), sourcePolicy: config.sourcePolicy }),
    identify: config.plantnetKey ? new PlantNetProvider(config.plantnetKey) : null
  };
}
