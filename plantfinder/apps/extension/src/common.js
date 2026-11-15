// Shared helpers for the extension pages and the service worker. No secrets live here: in server mode the
// PlantFinder API holds provider keys; in static mode the snapshot passphrase stays in chrome.storage.local.
import { decodeSnapshot, hydrateListings, resolveQuery, searchSnapshot } from "@plantfinder/shared";
import { findLocality } from "@plantfinder/shared/gazetteer";

/** Default: the free GitHub Pages site. A self-hosted API server (e.g. http://localhost:8787/) also works. */
export const DEFAULT_SITE = "https://danielsharon1.github.io/daniel-sharon/";

/** Accept only http(s) URLs without credentials; keep origin + path (static sites live under a path). */
export function normalizeBase(value) {
  try {
    const u = new URL(String(value).trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    const path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

export async function getSiteBase() {
  const { apiBase } = await chrome.storage.sync.get({ apiBase: DEFAULT_SITE });
  return normalizeBase(apiBase) ?? DEFAULT_SITE;
}
export const getApiBase = getSiteBase; // backwards-compatible name

export async function getPassphrase() {
  const { passphrase } = await chrome.storage.local.get({ passphrase: "" });
  return passphrase || null;
}

function fail(code, status = 0) {
  return Object.assign(new Error(code), { code, status });
}

async function getJson(url, init) {
  let res;
  try {
    res = await fetch(url, { credentials: "omit", ...init });
  } catch {
    throw fail("unreachable");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw fail(body.error || "request_failed", res.status);
  return body;
}

/** "static" (GitHub Pages snapshot) or "server" (PlantFinder API). */
export async function detectBackend(base) {
  const b = base ?? (await getSiteBase());
  try {
    const meta = await getJson(new URL("data/meta.json", b));
    if (meta && meta.version) return { kind: "static", base: b, meta };
  } catch {
    /* not a static site */
  }
  await getJson(new URL("api/health", b)); // throws "unreachable" when neither answers
  return { kind: "server", base: b };
}

export async function apiGet(path) {
  return getJson(new URL(path.replace(/^\//, ""), await getSiteBase()));
}

export async function apiPost(path, payload) {
  return getJson(new URL(path.replace(/^\//, ""), await getSiteBase()), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

let snapshotCache = null;
async function loadSnapshot(backend) {
  if (snapshotCache && snapshotCache.generatedAt === backend.meta.generatedAt) return snapshotCache;
  const res = await fetch(new URL("data/index.bin", backend.base), { credentials: "omit" }).catch(() => null);
  if (!res || !res.ok) throw fail("unreachable");
  const passphrase = backend.meta.encryption ? await getPassphrase() : null;
  if (backend.meta.encryption && !passphrase) throw fail("passphrase_required", 401);
  let index;
  try {
    index = await decodeSnapshot(backend.meta, new Uint8Array(await res.arrayBuffer()), passphrase);
  } catch (e) {
    throw fail(e && e.code === "wrong_passphrase" ? "wrong_passphrase" : "snapshot_unavailable", 401);
  }
  snapshotCache = { generatedAt: backend.meta.generatedAt, index, listings: hydrateListings(index) };
  return snapshotCache;
}

/**
 * Search through whichever backend the configured site provides. Params: { q, city, radiusKm, maxPrice, lang }.
 * In static mode the strict search runs right here on the decrypted snapshot.
 */
export async function searchPlants(params) {
  const backend = await detectBackend();
  if (backend.kind === "server") {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    return getJson(new URL(`api/search?${q}`, backend.base));
  }
  const { index, listings } = await loadSnapshot(backend);
  let location = null;
  if (params.city) {
    const loc = findLocality(params.city);
    if (!loc) throw fail("unknown_city", 400);
    location = { lat: loc.lat, lon: loc.lon, label: params.lang === "en" ? loc.en : loc.he };
  }
  return searchSnapshot(index, listings, {
    q: String(params.q).slice(0, 80),
    location,
    radiusKm: location && params.radiusKm ? Number(params.radiusKm) : null,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : null,
    minPrice: null,
    inStockOnly: true,
    includeRelated: true,
    sizes: [],
    sellerTypes: [],
    sort: "price",
    lang: params.lang === "en" ? "en" : "he"
  });
}

/** Resolve free text (a page title) to a plant locally: same classifier as the site, no network needed. */
export function resolveTitle(text) {
  return resolveQuery(String(text).slice(0, 300)).resolved;
}

/** URL of the web app search page on the configured site. */
export async function webSearchUrl(params) {
  const base = await getSiteBase();
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return `${base}?${q.toString()}`;
}

export function uiLang() {
  return (chrome.i18n?.getUILanguage?.() || navigator.language || "he").toLowerCase().startsWith("he") ? "he" : "en";
}

export function formatPrice(amount, lang) {
  return new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/** Build DOM safely (text only, never innerHTML with remote data). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : String(c));
  return node;
}

/** Only ever link to https listing URLs returned by the API. */
export function safeHref(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
