import type { IdentifyResponse, SearchResponse, SellerType, SizeClass, SortKey, SourcePublicInfo } from "@plantfinder/shared";
import type { Lang } from "./i18n";

export interface SearchParams {
  q: string;
  city: string;
  lat: number | null;
  lon: number | null;
  radiusKm: number | null;
  maxPrice: number | null;
  minPrice: number | null;
  inStockOnly: boolean;
  includeRelated: boolean;
  sizes: SizeClass[];
  sellerTypes: SellerType[];
  sort: SortKey;
}

export const DEFAULT_PARAMS: SearchParams = {
  q: "",
  city: "",
  lat: null,
  lon: null,
  radiusKm: 25,
  maxPrice: null,
  minPrice: null,
  inStockOnly: true,
  includeRelated: true,
  sizes: [],
  sellerTypes: [],
  sort: "price"
};

export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("network", 0);
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? "internal_error", res.status);
  return body;
}

export function toQuery(p: SearchParams, lang: Lang): URLSearchParams {
  const s = new URLSearchParams();
  s.set("q", p.q.trim());
  const hasLocation = !!p.city.trim() || (p.lat !== null && p.lon !== null);
  if (p.city.trim()) s.set("city", p.city.trim());
  else if (p.lat !== null && p.lon !== null) {
    s.set("lat", String(p.lat));
    s.set("lon", String(p.lon));
  }
  if (hasLocation && p.radiusKm !== null) s.set("radiusKm", String(p.radiusKm));
  if (p.maxPrice !== null) s.set("maxPrice", String(p.maxPrice));
  if (p.minPrice !== null) s.set("minPrice", String(p.minPrice));
  if (!p.inStockOnly) s.set("inStockOnly", "false");
  if (!p.includeRelated) s.set("includeRelated", "false");
  if (p.sizes.length) s.set("sizes", p.sizes.join(","));
  if (p.sellerTypes.length) s.set("sellerTypes", p.sellerTypes.join(","));
  if (p.sort !== "price") s.set("sort", p.sort);
  s.set("lang", lang);
  return s;
}

const num = (v: string | null): number | null => (v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Read search state from the page URL (shareable links; the extension opens the app this way). */
export function fromUrl(search: string): SearchParams & { lang: Lang | null } {
  const s = new URLSearchParams(search);
  const list = <T extends string>(v: string | null, allowed: readonly T[]) => (v ? (v.split(",").filter((x) => (allowed as readonly string[]).includes(x)) as T[]) : []);
  const lang = s.get("lang");
  return {
    q: s.get("q") ?? "",
    city: s.get("city") ?? "",
    lat: num(s.get("lat")),
    lon: num(s.get("lon")),
    radiusKm: s.has("radiusKm") ? num(s.get("radiusKm")) : DEFAULT_PARAMS.radiusKm,
    maxPrice: num(s.get("maxPrice")),
    minPrice: num(s.get("minPrice")),
    inStockOnly: s.get("inStockOnly") !== "false",
    includeRelated: s.get("includeRelated") !== "false",
    sizes: list(s.get("sizes"), ["XS", "S", "M", "L", "XL", "XXL"] as const),
    sellerTypes: list(s.get("sellerTypes"), ["nursery", "online_store", "classifieds", "chain_store"] as const),
    sort: (["price", "distance", "freshness", "relevance"] as const).find((x) => x === s.get("sort")) ?? "price",
    lang: lang === "en" || lang === "he" ? lang : null
  };
}

export const api = {
  search: (p: SearchParams, lang: Lang, signal?: AbortSignal) => request<SearchResponse>(`/api/search?${toQuery(p, lang)}`, { signal }),
  sources: () => request<{ dataMode: "live" | "fixture"; sourcePolicy: "personal" | "public"; sources: SourcePublicInfo[] }>("/api/sources"),
  health: () => request<{ dataMode: "live" | "fixture"; sourcePolicy: string; identifyAvailable: boolean }>("/api/health"),
  suggest: (q: string, signal?: AbortSignal) =>
    request<{ taxa: { id: string; he: string; en: string; scientificName: string }[]; cities: { id: number; he: string; en: string }[] }>(
      `/api/suggest?q=${encodeURIComponent(q)}`,
      { signal }
    ),
  identify: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<IdentifyResponse>("/api/identify", { method: "POST", body: form });
  }
};

// ---- Saved searches (this browser only) ------------------------------------------------------
export interface SavedSearch {
  id: string;
  label: string;
  query: string; // URL query string
  savedAt: string;
}
const KEY = "plantfinder.saved.v1";

export function loadSaved(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(data) ? (data as SavedSearch[]).filter((s) => typeof s?.query === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function storeSaved(list: SavedSearch[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // storage unavailable (private mode): saving silently disabled
  }
}
