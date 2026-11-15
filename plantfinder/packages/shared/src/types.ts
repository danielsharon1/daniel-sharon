/** Shared domain types for PlantFinder. Every listing is grounded in a real source record. */

export type Lang = "he" | "en";

export type MatchLevel =
  | "cultivar" // a named cultivar of the target species was identified
  | "species" // the species was named explicitly
  | "genus-default" // only a genus/common name that, by Israeli market convention, means this species
  | "genus" // only the genus is known
  | "text" // plant not in taxonomy; matched by text tokens only
  | "none";

export interface Classification {
  taxonId: string | null;
  scientificName: string | null;
  cultivar: string | null;
  level: MatchLevel;
  /** 0..1 heuristic confidence of the species assignment. */
  confidence: number;
  matchedName: string | null;
}

export type SizeClass = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export interface SizeInfo {
  sizeClass: SizeClass | null;
  potDiameterCm: number | null;
  heightCm: { min: number; max: number } | null;
  potVolumeL: number | null;
  /** Text fragments the size was parsed from (for transparency). */
  evidence: string[];
}

export type Availability = "in_stock" | "out_of_stock" | "unknown";

export type PriceKind = "fixed" | "from" | "unknown";

export interface Price {
  amount: number | null; // ILS, major units
  currency: "ILS";
  kind: PriceKind;
  regularAmount: number | null;
  onSale: boolean;
}

export type LocationPrecision = "address" | "locality";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface SellerLocation extends GeoPoint {
  label: { he: string; en: string };
  precision: LocationPrecision;
  /** Where the coordinates came from (URL + how). */
  evidence: string;
}

export type SellerType = "nursery" | "online_store" | "classifieds" | "chain_store";

export interface SellerInfo {
  name: { he: string; en: string };
  type: SellerType;
  /** null = no verified physical location (e.g. online-only store). Never guessed. */
  location: SellerLocation | null;
  pickup: "yes" | "by_appointment" | "no" | "unknown";
  delivery: { he: string; en: string; evidence: string } | null;
}

export type ProductKind = "plant" | "accessory" | "unknown";

export type QualityFlag =
  | "demo" // record comes from a recorded fixture, not a live fetch
  | "stale" // retrieved long ago
  | "genus_only_name" // species inferred from a generic name
  | "price_from" // price is the lowest of a range of variants
  | "price_unknown"
  | "location_unknown"
  | "location_locality_precision"
  | "availability_unknown"
  | "on_sale"
  | "no_image"
  | "size_unknown"
  | "permission_pending"; // source used under personal-pilot policy, written permission not yet granted

export interface Provenance {
  method: "woocommerce-store-api" | "shopify-products-json" | "fixture";
  endpoint: string;
  retrievedAt: string; // ISO timestamp of the fetch that produced this record
  demo: boolean;
}

export interface Listing {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  /** Representative variant; `options` = how many variants (e.g. pot styles) share this plant size. */
  variant: { id: string; label: string; options: number } | null;
  price: Price;
  availability: Availability;
  size: SizeInfo;
  classification: Classification;
  productKind: ProductKind;
  seller: SellerInfo;
  provenance: Provenance;
  categories: string[];
  flags: QualityFlag[];
}

export type Bucket =
  | "match" // satisfies every strict constraint
  | "location_unknown" // everything else OK, but seller location is not verified
  | "outside_radius" // verified location beyond the radius
  | "related_species"; // same genus / look-alike name, but a different taxon

export interface ResultItem extends Listing {
  bucket: Bucket;
  distanceKm: number | null;
}

export type SortKey = "price" | "distance" | "freshness" | "relevance";

export interface SearchRequest {
  q: string;
  /** Optional resolved location of the user. */
  location: (GeoPoint & { label: string }) | null;
  radiusKm: number | null;
  maxPrice: number | null;
  minPrice: number | null;
  inStockOnly: boolean;
  includeRelated: boolean;
  sizes: SizeClass[];
  sellerTypes: SellerType[];
  sort: SortKey;
  lang: Lang;
}

export interface SourceRunStatus {
  sourceId: string;
  status: "ok" | "error" | "skipped" | "blocked";
  message: string | null;
  fetched: number;
  durationMs: number;
  retrievedAt: string | null;
  fromCache: boolean;
}

export interface HiddenCounts {
  outOfStock: number;
  overBudget: number;
  underMinPrice: number;
  priceUnknown: number;
  accessories: number;
  sizeMismatch: number;
  sellerTypeMismatch: number;
  unrelated: number;
  duplicates: number;
}

export interface ResolvedQuery {
  text: string;
  taxon: {
    id: string;
    scientificName: string;
    he: string;
    en: string;
    level: MatchLevel;
    rank: string;
  } | null;
  sourceTerms: string[];
  note: string | null;
}

export interface SearchResponse {
  query: ResolvedQuery;
  request: SearchRequest;
  items: ResultItem[];
  counts: Record<Bucket, number>;
  hidden: HiddenCounts;
  sources: SourceRunStatus[];
  dataMode: "live" | "fixture";
  sourcePolicy: "personal" | "public";
  generatedAt: string;
}

export type SourceStatus = "partner" | "pilot" | "pending" | "rejected";

export interface SourcePublicInfo {
  id: string;
  name: { he: string; en: string };
  homepage: string;
  platform: string;
  status: SourceStatus;
  enabled: boolean;
  disabledReason: string | null;
  seller: SellerInfo;
  audit: {
    robots: string;
    terms: string;
    permission: string;
    method: string;
    checkedAt: string;
  };
  lastRefreshedAt: string | null;
}

export interface IdentifyCandidate {
  scientificName: string;
  commonNames: string[];
  score: number; // 0..1 provider score
  taxonId: string | null;
  he: string | null;
}

export interface IdentifyResponse {
  provider: string;
  candidates: IdentifyCandidate[];
  note: string;
}
