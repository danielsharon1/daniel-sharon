import {
  classifyText,
  decodeEntities,
  detectProductKind,
  hasSizeInfo,
  parseSize,
  type Availability,
  type Listing,
  type QualityFlag,
  type Provenance,
  type SizeInfo
} from "@plantfinder/shared";
import { createHash } from "node:crypto";
import type { SourceDef } from "../sources/registry.js";

export interface RawOffer {
  title: string;
  url: string;
  imageUrl: string | null;
  variantId: string | null;
  variantLabel: string | null;
  variantOptions?: number;
  price: number | null; // ILS major units
  regularPrice: number | null;
  priceKind: "fixed" | "from" | "unknown";
  availability: Availability;
  categories: string[];
}

export interface AdapterResult {
  listings: Listing[];
  retrievedAt: string;
  fromCache: boolean;
  requests: number;
  /** Partial degradation (e.g. stale cache served, some variant prices missing). */
  warning?: string;
}

export interface SourceAdapter {
  readonly source: SourceDef;
  search(terms: string[]): Promise<AdapterResult>;
  /** Entire public catalog (used by the periodic static-site snapshot). */
  fetchCatalog(): Promise<AdapterResult>;
}

export function safeHttpsUrl(u: string | null | undefined, base?: string): string | null {
  if (!u) return null;
  try {
    const url = new URL(u, base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildListing(source: SourceDef, raw: RawOffer, provenance: Provenance, policyPending: boolean): Listing | null {
  const url = safeHttpsUrl(raw.url);
  if (!url) return null; // never surface an offer without a valid source link
  const title = decodeEntities(raw.title).replace(/\s+/g, " ").trim();
  const variantLabel = raw.variantLabel ? decodeEntities(raw.variantLabel).trim() : null;
  const classification = classifyText(title);
  const size: SizeInfo = parseSize(title, variantLabel);
  const categories = raw.categories.map((c) => decodeEntities(c));
  const productKind = detectProductKind(title, categories, classification);

  const flags: QualityFlag[] = [];
  if (provenance.demo) flags.push("demo");
  if (classification.level === "genus-default") flags.push("genus_only_name");
  if (raw.priceKind === "from") flags.push("price_from");
  if (raw.price === null) flags.push("price_unknown");
  if (!source.seller.location) flags.push("location_unknown");
  else if (source.seller.location.precision === "locality") flags.push("location_locality_precision");
  if (raw.availability === "unknown") flags.push("availability_unknown");
  const onSale = raw.regularPrice !== null && raw.price !== null && raw.regularPrice > raw.price;
  if (onSale) flags.push("on_sale");
  if (!raw.imageUrl) flags.push("no_image");
  if (!hasSizeInfo(size)) flags.push("size_unknown");
  if (policyPending) flags.push("permission_pending");

  const id = createHash("sha1")
    .update(`${source.id}|${url}|${raw.variantId ?? ""}`)
    .digest("hex")
    .slice(0, 16);

  return {
    id,
    sourceId: source.id,
    title,
    url,
    imageUrl: safeHttpsUrl(raw.imageUrl),
    variant: raw.variantId && variantLabel ? { id: raw.variantId, label: variantLabel, options: raw.variantOptions ?? 1 } : null,
    price: { amount: raw.price, currency: "ILS", kind: raw.price === null ? "unknown" : raw.priceKind, regularAmount: onSale ? raw.regularPrice : null, onSale },
    availability: raw.availability,
    size,
    classification,
    productKind,
    seller: source.seller,
    provenance,
    categories,
    flags
  };
}

export interface VariantLike {
  id: string;
  label: string;
  price: number | null;
  regularPrice: number | null;
  available: Availability;
  url: string;
  imageUrl: string | null;
}

function sizeSignature(s: SizeInfo): string {
  return [s.sizeClass ?? "", s.potDiameterCm ?? "", s.heightCm ? `${s.heightCm.min}-${s.heightCm.max}` : "", s.potVolumeL ?? ""].join("|");
}

/**
 * Collapse product variants that differ only by non-size options (e.g. pot colour) into one offer
 * per plant size: the cheapest available variant represents the group; the price becomes "from"
 * when variants of that size are priced differently.
 */
export function groupVariantsBySize(title: string, variants: VariantLike[]): (VariantLike & { priceKind: "fixed" | "from"; options: number })[] {
  const groups = new Map<string, VariantLike[]>();
  for (const v of variants) {
    const sig = sizeSignature(parseSize(title, v.label));
    groups.set(sig, [...(groups.get(sig) ?? []), v]);
  }
  const out: (VariantLike & { priceKind: "fixed" | "from"; options: number })[] = [];
  for (const group of groups.values()) {
    const avail = group.filter((v) => v.available === "in_stock");
    const pool = (avail.length ? avail : group).filter((v) => v.price !== null);
    const pick = [...(pool.length ? pool : group)].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0]!;
    const prices = new Set(group.map((v) => v.price));
    out.push({
      ...pick,
      available: avail.length ? "in_stock" : group.every((v) => v.available === "out_of_stock") ? "out_of_stock" : pick.available,
      priceKind: prices.size > 1 ? "from" : "fixed",
      options: group.length
    });
  }
  return out;
}
