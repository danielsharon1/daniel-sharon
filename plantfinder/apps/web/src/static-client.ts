/**
 * Serverless client for the GitHub Pages build: loads the periodic snapshot (data/meta.json +
 * data/index.bin), decrypts it in the browser and runs the same strict search as the API.
 */
import {
  decodeSnapshot,
  hydrateListings,
  isPlausibleIsraelPoint,
  searchSnapshot,
  suggestTaxa,
  taxonByScientificName,
  SnapshotPassphraseError,
  type IdentifyCandidate,
  type IdentifyResponse,
  type Listing,
  type SearchRequest,
  type SnapshotIndex,
  type SnapshotMeta
} from "@plantfinder/shared";
import type { Client, SearchParams } from "./api";
import { ApiError } from "./errors";

const PASS_KEY = "plantfinder.passphrase.v1";
const PLANTNET_KEY: string = import.meta.env.VITE_PLANTNET_KEY ?? "";

let meta: SnapshotMeta | null = null;
let loaded: { index: SnapshotIndex; listings: Listing[] } | null = null;
let gazetteer: Promise<typeof import("@plantfinder/shared/gazetteer")> | null = null;
const loadGazetteer = () => (gazetteer ??= import("@plantfinder/shared/gazetteer"));

export async function loadMeta(): Promise<SnapshotMeta> {
  if (meta) return meta;
  const res = await fetch("data/meta.json", { cache: "no-cache" }).catch(() => null);
  if (!res?.ok) throw new ApiError("snapshot_unavailable", res?.status ?? 0);
  meta = (await res.json()) as SnapshotMeta;
  return meta;
}

export function storedPassphrase(): string | null {
  try {
    return localStorage.getItem(PASS_KEY);
  } catch {
    return null;
  }
}

export function forgetPassphrase(): void {
  try {
    localStorage.removeItem(PASS_KEY);
  } catch {
    /* ignore */
  }
  loaded = null;
}

export function isUnlocked(): boolean {
  return loaded !== null;
}

/** Decrypt and load the snapshot. Throws ApiError("passphrase_required" | "wrong_passphrase" | ...). */
export async function unlock(passphrase: string | null, remember: boolean): Promise<void> {
  const m = await loadMeta();
  const res = await fetch("data/index.bin", { cache: "no-cache" }).catch(() => null);
  if (!res?.ok) throw new ApiError("snapshot_unavailable", res?.status ?? 0);
  try {
    const index = await decodeSnapshot(m, new Uint8Array(await res.arrayBuffer()), passphrase);
    loaded = { index, listings: hydrateListings(index) };
  } catch (e) {
    if (e instanceof SnapshotPassphraseError) throw new ApiError(e.code, 401);
    throw new ApiError("snapshot_unavailable", 0);
  }
  if (passphrase && remember) {
    try {
      localStorage.setItem(PASS_KEY, passphrase);
    } catch {
      /* private mode: not remembered */
    }
  }
}

function requireLoaded() {
  if (!loaded) throw new ApiError("locked", 401);
  return loaded;
}

async function toRequest(p: SearchParams, lang: "he" | "en"): Promise<SearchRequest> {
  const q = p.q.trim();
  if (!q || q.length > 80) throw new ApiError("invalid_query", 400);
  let location: SearchRequest["location"] = null;
  if (p.city.trim()) {
    const loc = (await loadGazetteer()).findLocality(p.city);
    if (!loc) throw new ApiError("unknown_city", 400);
    location = { lat: loc.lat, lon: loc.lon, label: lang === "en" ? loc.en : loc.he };
  } else if (p.lat !== null && p.lon !== null) {
    if (!isPlausibleIsraelPoint({ lat: p.lat, lon: p.lon })) throw new ApiError("location_outside_israel", 400);
    location = { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100, label: lang === "en" ? "My location" : "המיקום שלי" };
  }
  if (p.minPrice !== null && p.maxPrice !== null && p.minPrice > p.maxPrice) throw new ApiError("min_price_above_max", 400);
  return {
    q,
    location,
    radiusKm: location ? p.radiusKm : null,
    maxPrice: p.maxPrice,
    minPrice: p.minPrice,
    inStockOnly: p.inStockOnly,
    includeRelated: p.includeRelated,
    sizes: p.sizes,
    sellerTypes: p.sellerTypes,
    sort: p.sort,
    lang
  };
}

interface PlantNetResult {
  score: number;
  species: { scientificNameWithoutAuthor: string; commonNames?: string[] };
}

async function plantnet(init: { file?: File; imageUrl?: string }): Promise<IdentifyResponse> {
  if (!PLANTNET_KEY) throw new ApiError("identify_unavailable", 503);
  const base = `https://my-api.plantnet.org/v2/identify/all?include-related-images=false&nb-results=5&lang=en&api-key=${encodeURIComponent(PLANTNET_KEY)}`;
  let res: Response;
  try {
    if (init.file) {
      if (init.file.size > 6 * 1024 * 1024) throw new ApiError("image_too_large", 413);
      if (!/^image\/(jpeg|png|webp)$/.test(init.file.type)) throw new ApiError("unsupported_image_type", 415);
      const form = new FormData();
      form.append("images", init.file);
      form.append("organs", "auto");
      res = await fetch(base, { method: "POST", body: form });
    } else {
      // Pl@ntNet downloads the image itself; the browser only passes the URL.
      res = await fetch(`${base}&images=${encodeURIComponent(init.imageUrl!)}&organs=auto`);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("network", 0);
  }
  if (res.status === 404) return { provider: "Pl@ntNet", candidates: [], note: "no_match" };
  if (res.status === 429) throw new ApiError("identify_quota_exceeded", 503);
  if (!res.ok) throw new ApiError("identify_provider_error", 502);
  const data = (await res.json()) as { results?: PlantNetResult[] };
  const candidates: IdentifyCandidate[] = (data.results ?? []).slice(0, 5).map((r) => {
    const taxon = taxonByScientificName(r.species.scientificNameWithoutAuthor);
    return {
      scientificName: r.species.scientificNameWithoutAuthor,
      commonNames: (r.species.commonNames ?? []).slice(0, 3),
      score: Math.max(0, Math.min(1, r.score)),
      taxonId: taxon?.id ?? null,
      he: taxon?.he[0] ?? null
    };
  });
  const top = candidates[0]?.score ?? 0;
  return { provider: "Pl@ntNet", candidates, note: candidates.length === 0 ? "no_match" : top < 0.3 ? "low_confidence" : "confirm_required" };
}

export const staticClient: Client = {
  async search(p, lang) {
    const { index, listings } = requireLoaded();
    return searchSnapshot(index, listings, await toRequest(p, lang));
  },
  async sources() {
    const { index } = requireLoaded();
    return { dataMode: index.dataMode, sourcePolicy: index.sourcePolicy, sources: index.sources };
  },
  async health() {
    const m = await loadMeta();
    return { dataMode: m.dataMode === "fixture" ? "fixture" : "snapshot", sourcePolicy: loaded?.index.sourcePolicy ?? "personal", identifyAvailable: !!PLANTNET_KEY };
  },
  async suggest(q) {
    const cities = (await loadGazetteer()).suggestLocalities(q, 5).map((l) => ({ id: l.id, he: l.he, en: l.en }));
    return { taxa: suggestTaxa(q, 6), cities };
  },
  identify: (file) => plantnet({ file }),
  identifyUrl: (imageUrl) => {
    if (!/^https?:\/\//i.test(imageUrl)) return Promise.reject(new ApiError("invalid_url", 400));
    return plantnet({ imageUrl });
  }
};
