import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { SearchResponse, SourcePublicInfo } from "@plantfinder/shared";
import { parseRobots } from "./robots.js";
import { BlockedError, LiveTransport, looksLikeChallenge, type Transport } from "./http.js";
import { CachingTransport } from "./cache.js";
import { FixtureTransport } from "./fixture-transport.js";
import { SearchService } from "./search-service.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { isNonPublicIp, assertPublicUrl } from "./net-guard.js";
import { sniffImage, type IdentifyProvider } from "./identify.js";
import { SOURCES } from "./sources/registry.js";

const FIXTURES = join(fileURLToPath(new URL(".", import.meta.url)), "../fixtures");

describe("robots.txt", () => {
  it("applies longest-match with Allow winning ties, wildcards and agent groups", () => {
    const r = parseRobots(
      ["User-agent: *", "Disallow: /wp-", "Allow: /wp-content/uploads/", "Disallow: /*?add-to-cart=", "", "User-agent: BadBot", "Disallow: /"].join("\n"),
      "PlantFinderBot/0.1"
    );
    expect(r.isAllowed("/wp-json/wc/store/v1/products")).toBe(false);
    expect(r.isAllowed("/wp-content/uploads/a.png")).toBe(true);
    expect(r.isAllowed("/shop?add-to-cart=5")).toBe(false);
    expect(r.isAllowed("/products.json")).toBe(true);
    expect(parseRobots("User-agent: badbot\nDisallow: /", "BadBot/1").isAllowed("/x")).toBe(false);
  });
  it("treats an empty Disallow as allow-all", () => {
    expect(parseRobots("User-agent: *\nDisallow:", "x").isAllowed("/anything")).toBe(true);
  });
  it("matches Hebrew (percent-encoded) paths", () => {
    expect(parseRobots("User-agent: *\nDisallow: /חנות/", "x").isAllowed("/%D7%97%D7%A0%D7%95%D7%AA/item")).toBe(false);
  });
});

function mockFetch(routes: Record<string, { status: number; body: string; headers?: Record<string, string> }>, calls: string[] = []): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    const r = routes[url] ?? { status: 404, body: "not found" };
    return new Response(r.body, { status: r.status, headers: r.headers });
  }) as typeof fetch;
}

describe("LiveTransport (polite client)", () => {
  it("refuses paths disallowed by robots.txt", async () => {
    const t = new LiveTransport({
      userAgent: "PlantFinderBot/0.1",
      minIntervalMs: 0,
      fetchImpl: mockFetch({ "https://shop.test/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /wp-" } })
    });
    await expect(t.getJson("https://shop.test/wp-json/wc/store/v1/products")).rejects.toBeInstanceOf(BlockedError);
  });
  it("detects bot challenges, opens a circuit and does not retry", async () => {
    const calls: string[] = [];
    const t = new LiveTransport({
      userAgent: "PlantFinderBot/0.1",
      minIntervalMs: 0,
      fetchImpl: mockFetch(
        {
          "https://cf.test/robots.txt": { status: 200, body: "" },
          "https://cf.test/api": { status: 403, body: "<title>Just a moment...</title>", headers: { "cf-mitigated": "challenge" } }
        },
        calls
      )
    });
    await expect(t.getJson("https://cf.test/api")).rejects.toBeInstanceOf(BlockedError);
    await expect(t.getJson("https://cf.test/api")).rejects.toThrow(/Circuit open/);
    expect(calls.filter((c) => c.endsWith("/api"))).toHaveLength(1);
  });
  it("caps the per-host queue instead of piling requests onto a source", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slowFetch = (async (input: string | URL) => {
      if (String(input).endsWith("/robots.txt")) return new Response("", { status: 200 });
      await gate;
      return new Response("[]", { status: 200 });
    }) as typeof fetch;
    const t = new LiveTransport({ userAgent: "x", minIntervalMs: 0, maxQueuePerHost: 3, fetchImpl: slowFetch });
    const inflight = [1, 2, 3].map((n) => t.getJson(`https://q.test/${n}`));
    await expect(t.getJson("https://q.test/4")).rejects.toBeInstanceOf(BlockedError);
    release();
    await Promise.all(inflight);
    await expect(t.getJson("https://q.test/5")).resolves.toBeTruthy();
  });
  it("only allows https", async () => {
    const t = new LiveTransport({ userAgent: "x", fetchImpl: mockFetch({}) });
    await expect(t.getJson("http://shop.test/x")).rejects.toThrow(/https/);
  });
  it("recognises Cloudflare challenge pages", () => {
    expect(looksLikeChallenge(403, {}, "<title>Just a moment...</title>")).toBe(true);
    expect(looksLikeChallenge(200, {}, "[]")).toBe(false);
  });
});

describe("CachingTransport", () => {
  it("serves within TTL and falls back to a labeled stale copy when the source fails", async () => {
    let fail = false;
    let n = 0;
    const inner: Transport = {
      kind: "live",
      async getJson() {
        n++;
        if (fail) throw new Error("source down");
        return { status: 200, json: { n }, headers: {}, fetchedAt: new Date().toISOString() };
      }
    };
    let ttl = 60_000;
    const c = new CachingTransport(inner, { ttlMsFor: () => ttl, maxStaleMs: 3600_000 });
    const a = await c.getJson("https://x.test/a");
    const b = await c.getJson("https://x.test/a");
    expect(n).toBe(1);
    expect(b.fromCache).toBe(true);
    ttl = 0;
    fail = true;
    const s = await c.getJson("https://x.test/a");
    expect(s.json).toEqual(a.json);
    expect(s.staleFallback).toMatch(/source down/);
  });
});

describe("SSRF guard and upload validation", () => {
  it("classifies non-public addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
      expect(isNonPublicIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "151.101.1.1", "2606:4700::1111"]) expect(isNonPublicIp(ip), ip).toBe(false);
  });
  it("rejects URLs that resolve to private networks, odd ports and credentials", async () => {
    const resolver = async (h: string) => (h === "evil.test" ? ["10.0.0.5"] : ["93.184.216.34"]);
    await expect(assertPublicUrl("http://127.0.0.1/x.png", resolver)).rejects.toThrow("non_public_host");
    await expect(assertPublicUrl("https://evil.test/x.png", resolver)).rejects.toThrow("non_public_host");
    await expect(assertPublicUrl("https://localhost/x.png", resolver)).rejects.toThrow("non_public_host");
    await expect(assertPublicUrl("https://good.test:8443/x.png", resolver)).rejects.toThrow("unsupported_port");
    await expect(assertPublicUrl("https://u:p@good.test/x.png", resolver)).rejects.toThrow("credentials_in_url");
    await expect(assertPublicUrl("file:///etc/passwd", resolver)).rejects.toThrow("unsupported_protocol");
    await expect(assertPublicUrl("https://good.test/x.png", resolver)).resolves.toBeInstanceOf(URL);
  });
  it("sniffs image types from magic bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("adapters on recorded real responses", () => {
  const service = new SearchService({ transport: new FixtureTransport(FIXTURES), sourcePolicy: "personal" });
  const base = { location: null, radiusKm: null, maxPrice: null, minPrice: null, inStockOnly: false, includeRelated: true, sizes: [], sellerTypes: [], sort: "price" as const, lang: "he" as const };

  it("every enabled source answers from fixtures and every item is labeled DEMO with provenance", async () => {
    const r = await service.search({ q: "מונסטרה", ...base });
    const ran = r.sources.filter((s) => s.status !== "skipped");
    expect(ran.length).toBeGreaterThanOrEqual(6);
    expect(ran.every((s) => s.status === "ok")).toBe(true);
    expect(r.items.length).toBeGreaterThan(20);
    for (const i of r.items) {
      expect(i.flags).toContain("demo");
      expect(i.provenance.demo).toBe(true);
      expect(i.url).toMatch(/^https:\/\//);
      expect(Date.parse(i.provenance.retrievedAt)).toBeGreaterThan(0);
      expect(i.seller).toBeTruthy();
    }
  });

  it("converts WooCommerce minor units correctly (whole shekels vs agorot)", async () => {
    const r = await service.search({ q: "מונסטרה", ...base });
    const hamashtela = r.items.filter((i) => i.sourceId === "hamashtela" && i.price.amount !== null);
    const neta = r.items.filter((i) => i.sourceId === "netaplants" && i.price.amount !== null);
    expect(hamashtela.length).toBeGreaterThan(0);
    expect(neta.length).toBeGreaterThan(0);
    // hamashtela reports minor_unit 0 (e.g. "320"), netaplants minor_unit 2 (e.g. "4200"); both must land in a sane ILS range.
    for (const i of [...hamashtela, ...neta]) {
      expect(i.price.amount!).toBeGreaterThan(5);
      expect(i.price.amount!).toBeLessThan(5000);
    }
  });

  it("collapses pot-style variants into one offer per plant size", async () => {
    const r = await service.search({ q: "מונסטרה", ...base });
    const neta = r.items.filter((i) => i.sourceId === "netaplants" && i.title === "מונסטרה נאה");
    const sizes = neta.map((i) => i.size.sizeClass);
    expect(new Set(sizes).size).toBe(sizes.length);
    expect(neta.some((i) => (i.variant?.options ?? 1) > 1)).toBe(true);
  });
});

describe("HTTP API (fixture mode)", () => {
  let app: FastifyInstance;
  const fakeProvider: IdentifyProvider = {
    name: "test-provider",
    async identify() {
      return [{ scientificName: "Monstera deliciosa", commonNames: ["Swiss cheese plant"], score: 0.82, taxonId: "monstera-deliciosa", he: "מונסטרה דליסיוזה" }];
    }
  };
  beforeAll(async () => {
    const config = { ...loadConfig({ PF_DATA_MODE: "fixture" }), fixturesDir: FIXTURES, webDist: null };
    const search = new SearchService({ transport: new FixtureTransport(FIXTURES), sourcePolicy: "personal" });
    app = await buildApp({ config, search, identify: fakeProvider, resolver: async () => ["10.0.0.1"] });
  });
  afterAll(async () => app.close());

  const get = async (url: string) => {
    const res = await app.inject({ method: "GET", url });
    return { status: res.statusCode, body: res.json(), headers: res.headers };
  };

  it("health reports fixture mode and enabled sources", async () => {
    const { status, body, headers } = await get("/api/health");
    expect(status).toBe(200);
    expect(body.dataMode).toBe("fixture");
    expect(body.enabledSources).toHaveLength(6);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["cache-control"]).toBe("no-store");
  });

  it("benchmark: Monstera / Netanya / 25 km / ≤150 ILS never confirms unknown or out-of-range locations", async () => {
    const { status, body } = await get(`/api/search?q=Monstera&city=${encodeURIComponent("נתניה")}&radiusKm=25&maxPrice=150`);
    expect(status).toBe(200);
    const r = body as SearchResponse;
    expect(r.request.location?.label).toBe("נתניה");
    for (const i of r.items) {
      if (i.bucket === "match") {
        expect(i.seller.location).not.toBeNull();
        expect(i.distanceKm).not.toBeNull();
        expect(i.distanceKm!).toBeLessThanOrEqual(25);
        expect(i.price.amount!).toBeLessThanOrEqual(150);
        expect(i.availability).not.toBe("out_of_stock");
        expect(i.classification.taxonId).toBe("monstera-deliciosa");
      }
      if (i.seller.location === null) expect(i.bucket === "location_unknown" || i.bucket === "related_species").toBe(true);
      if (i.distanceKm !== null && i.distanceKm > 25) expect(["outside_radius", "related_species"]).toContain(i.bucket);
      expect(i.price.amount!).toBeLessThanOrEqual(150);
    }
    expect(r.counts.location_unknown).toBeGreaterThan(0);
    expect(r.counts.outside_radius).toBeGreaterThan(0);
  });

  it("Monstera / מונסטרה / Monstera deliciosa return identical species-aware results", async () => {
    const qs = ["Monstera", "מונסטרה", "Monstera deliciosa"];
    const results = await Promise.all(qs.map((q) => get(`/api/search?q=${encodeURIComponent(q)}&inStockOnly=false`)));
    const ids = results.map((r) => (r.body as SearchResponse).items.map((i) => `${i.id}:${i.bucket}`).join(","));
    expect(ids[0]!.length).toBeGreaterThan(0);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).toBe(ids[0]);
    for (const r of results) expect((r.body as SearchResponse).query.taxon?.id).toBe("monstera-deliciosa");
  });

  it("20 repeated searches complete without critical failure and are deterministic", async () => {
    const first = await get("/api/search?q=Monstera&city=Netanya&radiusKm=25&maxPrice=150");
    for (let i = 0; i < 19; i++) {
      const r = await get("/api/search?q=Monstera&city=Netanya&radiusKm=25&maxPrice=150");
      expect(r.status).toBe(200);
      expect((r.body as SearchResponse).items.map((x) => x.id)).toEqual((first.body as SearchResponse).items.map((x) => x.id));
    }
  });

  it("validates input", async () => {
    expect((await get("/api/search?q=")).status).toBe(400);
    expect((await get(`/api/search?q=${"a".repeat(81)}`)).status).toBe(400);
    expect((await get("/api/search?q=monstera&city=Atlantis")).body.error).toBe("unknown_city");
    expect((await get("/api/search?q=monstera&radiusKm=25")).body.error).toBe("radius_requires_location");
    expect((await get("/api/search?q=monstera&lat=48.85&lon=2.35")).body.error).toBe("location_outside_israel");
    expect((await get("/api/search?q=monstera&sizes=HUGE")).status).toBe(400);
    expect((await get("/api/search?q=monstera&minPrice=200&maxPrice=100")).body.error).toBe("min_price_above_max");
  });

  it("coarsens browser coordinates before use", async () => {
    const { body } = await get("/api/search?q=monstera&lat=32.33294&lon=34.85917&radiusKm=25");
    expect((body as SearchResponse).request.location).toMatchObject({ lat: 32.33, lon: 34.86 });
  });

  it("lists all audited sources incl. rejected ones with reasons", async () => {
    const { body } = await get("/api/sources");
    const sources = body.sources as SourcePublicInfo[];
    expect(sources.length).toBe(SOURCES.length);
    const fb = sources.find((s) => s.id === "facebook")!;
    expect(fb.enabled).toBe(false);
    expect(fb.status).toBe("rejected");
    expect(sources.find((s) => s.id === "plantit")!.disabledReason).toMatch(/Cloudflare/);
  });

  it("suggest returns plants and cities", async () => {
    const { body } = await get(`/api/suggest?q=${encodeURIComponent("נת")}`);
    expect(body.cities[0].he).toBe("נתניה");
    const plants = await get(`/api/suggest?q=${encodeURIComponent("מונס")}`);
    expect(plants.body.taxa.map((t: { id: string }) => t.id)).toContain("monstera-deliciosa");
  });

  it("resolves page titles for the extension", async () => {
    const { body } = await get(`/api/resolve?q=${encodeURIComponent("מונסטרה מאנקי – משתלה אונליין")}`);
    expect(body.taxon.id).toBe("monstera-adansonii");
  });

  it("identify: validates uploads by content, not by declared type", async () => {
    const boundary = "----pf";
    const multipart = (bytes: Buffer, type: string) =>
      Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a"\r\nContent-Type: ${type}\r\n\r\n`),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const ok = await app.inject({ method: "POST", url: "/api/identify", payload: multipart(png, "image/png"), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().candidates[0].taxonId).toBe("monstera-deliciosa");
    expect(ok.json().note).toBe("confirm_required");
    const svg = await app.inject({ method: "POST", url: "/api/identify", payload: multipart(Buffer.from("<svg/>"), "image/png"), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } });
    expect(svg.statusCode).toBe(415);
  });

  it("identify: refuses image URLs on private networks (SSRF)", async () => {
    const res = await app.inject({ method: "POST", url: "/api/identify", payload: { imageUrl: "https://intranet.example/a.jpg" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("non_public_host");
  });

  it("CORS: allows extension origins, not arbitrary sites", async () => {
    const ext = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "chrome-extension://abcdefghijklmnop" } });
    expect(ext.headers["access-control-allow-origin"]).toBe("chrome-extension://abcdefghijklmnop");
    const evil = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "https://evil.example" } });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("public policy disables every source without written permission", async () => {
    const svc = new SearchService({ transport: new FixtureTransport(FIXTURES), sourcePolicy: "public" });
    expect(svc.adapters).toHaveLength(0);
    const r = await svc.search({ q: "Monstera", location: null, radiusKm: null, maxPrice: null, minPrice: null, inStockOnly: false, includeRelated: true, sizes: [], sellerTypes: [], sort: "price", lang: "he" });
    expect(r.items).toHaveLength(0);
    expect(r.sources.every((s) => s.status === "skipped")).toBe(true);
  });
});

describe("identify unavailable", () => {
  it("returns 503 when no provider key is configured", async () => {
    const config = { ...loadConfig({ PF_DATA_MODE: "fixture" }), fixturesDir: FIXTURES, webDist: null };
    const app = await buildApp({ config, search: new SearchService({ transport: new FixtureTransport(FIXTURES), sourcePolicy: "personal" }), identify: null });
    const res = await app.inject({ method: "POST", url: "/api/identify", payload: { imageUrl: "https://example.com/a.jpg" } });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("identify_unavailable");
    await app.close();
  });
});
