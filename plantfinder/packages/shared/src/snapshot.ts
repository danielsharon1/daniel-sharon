/**
 * Static-site data format: a periodic snapshot of all audited sources, searched in the browser.
 *
 * The index is gzip-compressed and — for the personal pilot — encrypted with AES-GCM using a key
 * derived from a passphrase (PBKDF2-SHA256). This keeps the nurseries' catalog data unreadable on a
 * public static host for anyone without the passphrase. Uses only WebCrypto and Compression Streams,
 * available in Node >= 18, modern browsers and Chrome extensions.
 */
import type { Listing, SearchRequest, SearchResponse, SourcePublicInfo, SourceRunStatus } from "./types.js";
import { evaluateListings, relevanceFor, resolveQuery, textQueryTokens } from "./search-core.js";

export const SNAPSHOT_VERSION = 1;
export const PBKDF2_ITERATIONS = 400_000;

export interface SnapshotSource extends SourcePublicInfo {
  run: {
    status: SourceRunStatus["status"];
    message: string | null;
    fetchedAt: string | null;
    listings: number;
  };
}

/** Listing without the per-listing seller copy (rehydrated from the source on load). */
export type CompactListing = Omit<Listing, "seller">;

export interface SnapshotIndex {
  version: typeof SNAPSHOT_VERSION;
  generatedAt: string;
  sourcePolicy: "personal" | "public";
  dataMode: "live" | "fixture";
  sources: SnapshotSource[];
  listings: CompactListing[];
}

export interface SnapshotMeta {
  version: typeof SNAPSHOT_VERSION;
  generatedAt: string;
  dataMode: "live" | "fixture";
  counts: Record<string, number>;
  encryption: null | {
    alg: "AES-GCM";
    kdf: "PBKDF2-SHA256";
    iterations: number;
    salt: string; // base64
    iv: string; // base64
  };
}

export class SnapshotPassphraseError extends Error {
  constructor(readonly code: "passphrase_required" | "wrong_passphrase") {
    super(code);
    this.name = "SnapshotPassphraseError";
  }
}

// ---- encoding helpers -------------------------------------------------------------------------
function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function pipe(data: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Serialize (and optionally encrypt) an index. `passphrase === null` produces a plain, gzip-only file. */
export async function encodeSnapshot(index: SnapshotIndex, passphrase: string | null): Promise<{ meta: SnapshotMeta; bytes: Uint8Array }> {
  const gz = await pipe(new TextEncoder().encode(JSON.stringify(index)), new CompressionStream("gzip"));
  const counts: Record<string, number> = {};
  for (const s of index.sources) if (s.enabled) counts[s.id] = s.run.listings;
  const base = { version: SNAPSHOT_VERSION, generatedAt: index.generatedAt, dataMode: index.dataMode, counts } as const;
  if (passphrase === null) return { meta: { ...base, encryption: null }, bytes: gz };
  if (passphrase.length < 12) throw new Error("Snapshot passphrase must be at least 12 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const bytes = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, gz as BufferSource));
  return {
    meta: { ...base, encryption: { alg: "AES-GCM", kdf: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, salt: toBase64(salt), iv: toBase64(iv) } },
    bytes
  };
}

export async function decodeSnapshot(meta: SnapshotMeta, bytes: Uint8Array, passphrase: string | null): Promise<SnapshotIndex> {
  let gz = bytes;
  if (meta.encryption) {
    if (!passphrase) throw new SnapshotPassphraseError("passphrase_required");
    const key = await deriveKey(passphrase, fromBase64(meta.encryption.salt), meta.encryption.iterations);
    try {
      gz = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(meta.encryption.iv) as BufferSource }, key, bytes as BufferSource));
    } catch {
      throw new SnapshotPassphraseError("wrong_passphrase"); // GCM authentication failed
    }
  }
  const index = JSON.parse(new TextDecoder().decode(await pipe(gz, new DecompressionStream("gzip")))) as SnapshotIndex;
  if (index.version !== SNAPSHOT_VERSION) throw new Error(`Unsupported snapshot version ${String(index.version)}`);
  return index;
}

/** Re-attach seller info (stored once per source) to every listing. */
export function hydrateListings(index: SnapshotIndex): Listing[] {
  const sellers = new Map(index.sources.map((s) => [s.id, s.seller]));
  const out: Listing[] = [];
  for (const l of index.listings) {
    const seller = sellers.get(l.sourceId);
    if (seller) out.push({ ...l, seller });
  }
  return out;
}

export function compactListing(l: Listing): CompactListing {
  const { seller: _seller, ...rest } = l;
  return rest;
}

/**
 * Search a snapshot with the same strict rules as the API. Only listings relevant to the query are
 * evaluated, so "hidden" counts describe the plant that was searched, not the whole catalog.
 */
export function searchSnapshot(index: SnapshotIndex, listings: Listing[], request: SearchRequest, now: Date = new Date()): SearchResponse {
  const { resolved, target } = resolveQuery(request.q);
  const tokens = target ? [] : textQueryTokens(request.q);
  const candidates = resolved.sourceTerms.length ? listings.filter((l) => relevanceFor(l, target, tokens).kind !== "unrelated") : [];
  const { items, counts, hidden } = evaluateListings(candidates, request, target, now);
  const perSource = new Map<string, number>();
  for (const l of candidates) perSource.set(l.sourceId, (perSource.get(l.sourceId) ?? 0) + 1);
  const sources: SourceRunStatus[] = index.sources.map((s) => ({
    sourceId: s.id,
    status: s.enabled ? s.run.status : "skipped",
    message: s.enabled ? s.run.message : s.disabledReason,
    fetched: perSource.get(s.id) ?? 0,
    durationMs: 0,
    retrievedAt: s.run.fetchedAt,
    fromCache: true
  }));
  return {
    query: resolved,
    request,
    items,
    counts,
    hidden,
    sources,
    dataMode: index.dataMode === "fixture" ? "fixture" : "snapshot",
    snapshotGeneratedAt: index.generatedAt,
    sourcePolicy: index.sourcePolicy,
    generatedAt: now.toISOString()
  };
}
