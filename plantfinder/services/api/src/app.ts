import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { z } from "zod";
import { isPlausibleIsraelPoint, resolveQuery, suggestTaxa, type SearchRequest, type SizeClass, type SellerType } from "@plantfinder/shared";
import { findLocality, suggestLocalities, GAZETTEER_ATTRIBUTION } from "@plantfinder/shared/gazetteer";
import type { Config } from "./config.js";
import type { SearchService } from "./search-service.js";
import { fetchImageSafely, ImageError, MAX_IMAGE_BYTES, validateImage, type IdentifyProvider } from "./identify.js";
import type { Resolver } from "./net-guard.js";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const csv = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return [] as T[];
      const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
      for (const p of parts)
        if (!(allowed as readonly string[]).includes(p)) {
          ctx.addIssue({ code: "custom", message: `invalid value ${p}` });
          return z.NEVER;
        }
      return parts as T[];
    });

const num = (min: number, max: number) => z.coerce.number().min(min).max(max).optional();

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const satisfies readonly SizeClass[];
const SELLERS = ["nursery", "online_store", "classifieds", "chain_store"] as const satisfies readonly SellerType[];

export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(80),
  city: z.string().trim().max(60).optional(),
  lat: num(-90, 90),
  lon: num(-180, 180),
  radiusKm: num(1, 300),
  maxPrice: num(0, 100_000),
  minPrice: num(0, 100_000),
  inStockOnly: bool(true),
  includeRelated: bool(true),
  sizes: csv(SIZES),
  sellerTypes: csv(SELLERS),
  sort: z.enum(["price", "distance", "freshness", "relevance"]).default("price"),
  lang: z.enum(["he", "en"]).default("he")
});

export interface AppDeps {
  config: Config;
  search: SearchService;
  identify: IdentifyProvider | null;
  resolver?: Resolver;
  fetchImpl?: typeof fetch;
  logger?: boolean;
}

function sendError(reply: FastifyReply, status: number, error: string, details?: unknown) {
  return reply.code(status).send({ error, ...(details ? { details } : {}) });
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    logger: deps.logger ? { level: "info", redact: ["req.headers.authorization", "req.headers.cookie"] } : false,
    // Request URLs contain the user's search and possibly coordinates: do not log them by default.
    disableRequestLogging: true,
    bodyLimit: 64 * 1024,
    trustProxy: process.env.PF_TRUST_PROXY === "1"
  });

  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-frame-options", "DENY");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=(self)");
    const type = String(reply.getHeader("content-type") ?? "");
    if (type.includes("text/html")) {
      reply.header(
        "content-security-policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
      );
    }
    if (req.url.startsWith("/api/")) reply.header("cache-control", "no-store");
    return payload;
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / non-browser
      const ok = config.allowedOrigins.some((o) => (o.endsWith("*") ? origin.startsWith(o.slice(0, -1)) : origin === o));
      cb(null, ok);
    },
    methods: ["GET", "POST"]
  });
  // Rate-limit API calls only; static assets (fonts, JS) must not consume the budget.
  await app.register(rateLimit, { global: true, max: 120, timeWindow: "1 minute", allowList: (req) => !req.url.startsWith("/api/") });
  await app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 2, parts: 3 } });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _req, reply) => {
    if (err instanceof ImageError) return sendError(reply, err.status, err.code);
    if (err.code === "FST_REQ_FILE_TOO_LARGE") return sendError(reply, 413, "image_too_large");
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) app.log.error({ err: err.message }, "request failed");
    return sendError(reply, status, status === 429 ? "rate_limited" : status >= 500 ? "internal_error" : err.message);
  });

  app.get("/api/health", async () => ({
    ok: true,
    version: config.version,
    dataMode: deps.search.dataMode,
    sourcePolicy: config.sourcePolicy,
    enabledSources: deps.search.adapters.map((a) => a.source.id),
    identifyAvailable: deps.identify !== null
  }));

  app.get("/api/sources", async () => ({
    dataMode: deps.search.dataMode,
    sourcePolicy: config.sourcePolicy,
    sources: deps.search.sourcesInfo(),
    attribution: { gazetteer: GAZETTEER_ATTRIBUTION }
  }));

  app.get("/api/suggest", async (req) => {
    const q = z.object({ q: z.string().max(60).default("") }).parse(req.query).q;
    return {
      taxa: suggestTaxa(q, 6),
      cities: suggestLocalities(q, 5).map((l) => ({ id: l.id, he: l.he, en: l.en }))
    };
  });

  app.get("/api/cities", async (req) => {
    const q = z.object({ q: z.string().max(60).default("") }).parse(req.query).q;
    return { cities: suggestLocalities(q, 10).map((l) => ({ id: l.id, he: l.he, en: l.en, lat: l.lat, lon: l.lon })) };
  });

  /** Resolve free text (e.g. a product page title sent by the extension) to a plant. */
  app.get("/api/resolve", async (req, reply) => {
    const parsed = z.object({ q: z.string().trim().min(1).max(300) }).safeParse(req.query);
    if (!parsed.success) return sendError(reply, 400, "invalid_query");
    const { resolved } = resolveQuery(parsed.data.q);
    return resolved;
  });

  app.get("/api/search", { config: { rateLimit: { max: 40, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parsed = SearchQuery.safeParse(req.query);
    if (!parsed.success) return sendError(reply, 400, "invalid_query", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const p = parsed.data;
    let location: SearchRequest["location"] = null;
    if (p.city) {
      const loc = findLocality(p.city);
      if (!loc) return sendError(reply, 400, "unknown_city");
      location = { lat: loc.lat, lon: loc.lon, label: p.lang === "en" ? loc.en : loc.he };
    } else if (p.lat !== undefined && p.lon !== undefined) {
      const point = { lat: p.lat, lon: p.lon };
      if (!isPlausibleIsraelPoint(point)) return sendError(reply, 400, "location_outside_israel");
      // Coarsen user coordinates (~1 km) — enough for radius filtering, less identifying.
      location = { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100, label: p.lang === "en" ? "My location" : "המיקום שלי" };
    }
    if (p.radiusKm !== undefined && !location) return sendError(reply, 400, "radius_requires_location");
    if (p.minPrice !== undefined && p.maxPrice !== undefined && p.minPrice > p.maxPrice) return sendError(reply, 400, "min_price_above_max");
    const request: SearchRequest = {
      q: p.q,
      location,
      radiusKm: p.radiusKm ?? null,
      maxPrice: p.maxPrice ?? null,
      minPrice: p.minPrice ?? null,
      inStockOnly: p.inStockOnly,
      includeRelated: p.includeRelated,
      sizes: p.sizes,
      sellerTypes: p.sellerTypes,
      sort: p.sort,
      lang: p.lang
    };
    return deps.search.search(request);
  });

  app.post("/api/identify", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!deps.identify) return sendError(reply, 503, "identify_unavailable");
    let bytes: Uint8Array;
    let mime;
    if (req.isMultipart()) {
      const file = await req.file();
      if (!file) return sendError(reply, 400, "missing_image");
      const buf = await file.toBuffer(); // throws FST_REQ_FILE_TOO_LARGE above the limit
      bytes = new Uint8Array(buf);
      mime = validateImage(bytes);
    } else {
      const body = z.object({ imageUrl: z.string().url().max(2000) }).safeParse(req.body);
      if (!body.success) return sendError(reply, 400, "missing_image");
      const img = await fetchImageSafely(body.data.imageUrl, { resolver: deps.resolver, fetchImpl: deps.fetchImpl, userAgent: config.userAgent });
      bytes = img.bytes;
      mime = img.mime;
    }
    // The image is processed in memory and never stored.
    const candidates = await deps.identify.identify(bytes, mime);
    const top = candidates[0]?.score ?? 0;
    return {
      provider: deps.identify.name,
      candidates,
      note: candidates.length === 0 ? "no_match" : top < 0.3 ? "low_confidence" : "confirm_required"
    };
  });

  if (config.webDist && existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist, prefix: "/", index: ["index.html"], maxAge: "1h" });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/")) return reply.type("text/html").sendFile("index.html", { maxAge: 0 });
      return sendError(reply, 404, "not_found");
    });
  } else {
    app.setNotFoundHandler((_req, reply) => sendError(reply, 404, "not_found"));
  }

  return app;
}
