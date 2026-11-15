/**
 * Record real source responses for offline demo mode and tests:
 *   pnpm --filter @plantfinder/api record-fixtures [query ...]
 * Fixtures are real snapshots with their fetch timestamps; the app labels them DEMO.
 */
import { resolveQuery } from "@plantfinder/shared";
import { loadConfig } from "./config.js";
import { LiveTransport } from "./http.js";
import { RecordingTransport } from "./fixture-transport.js";
import { SearchService } from "./search-service.js";

const config = loadConfig();
const queries = process.argv.slice(2).length ? process.argv.slice(2) : ["Monstera", "פוטוס", "פיקוס כינורי", "סנסוויריה", "זמיוקולקס", "קלתאה", "אלוקסיה"];
const transport = new RecordingTransport(new LiveTransport({ userAgent: config.userAgent, minIntervalMs: 1200 }), config.fixturesDir);
const service = new SearchService({ transport, sourcePolicy: "personal" });
for (const q of queries) {
  const res = await service.search({ q, location: null, radiusKm: null, maxPrice: null, minPrice: null, inStockOnly: false, includeRelated: true, sizes: [], sellerTypes: [], sort: "price", lang: "he" });
  console.log(q, "->", resolveQuery(q).resolved.sourceTerms.join(","), "items:", res.items.length, res.sources.filter((s) => s.status !== "skipped").map((s) => `${s.sourceId}:${s.status}:${s.fetched}${s.message ? `(${s.message})` : ""}`).join(" "));
}
