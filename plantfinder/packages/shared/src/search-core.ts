import type {
  Bucket,
  HiddenCounts,
  Listing,
  MatchLevel,
  ResolvedQuery,
  ResultItem,
  SearchRequest,
  SortKey
} from "./types.js";
import { classifyText, getTaxon, relatedNameTokens, sourceSearchTerms, type TaxonDef } from "./taxonomy.js";
import { findPhrase, normalizeForMatch, tokenize } from "./text.js";
import { haversineKm } from "./geo.js";

export const STALE_AFTER_HOURS = 24;

/** Resolve a free-text query to a target taxon (if any) and the terms to send to sources. */
export function resolveQuery(q: string): { resolved: ResolvedQuery; target: TaxonDef | null } {
  const text = q.trim();
  const c = classifyText(text);
  const taxon = c.taxonId ? getTaxon(c.taxonId) ?? null : null;
  if (!taxon) {
    const terms = normalizeForMatch(text) ? [text] : [];
    return {
      target: null,
      resolved: {
        text,
        taxon: null,
        sourceTerms: terms,
        note: terms.length ? "not_in_taxonomy" : "empty_query"
      }
    };
  }
  return {
    target: taxon,
    resolved: {
      text,
      taxon: {
        id: taxon.id,
        scientificName: taxon.scientificName,
        he: taxon.he[0] ?? taxon.scientificName,
        en: taxon.en[0] ?? taxon.scientificName,
        level: c.level,
        rank: taxon.rank
      },
      sourceTerms: sourceSearchTerms(taxon),
      note: c.level === "genus-default" ? "genus_default" : null
    }
  };
}

type Relevance = { kind: "match"; level: MatchLevel } | { kind: "related" } | { kind: "unrelated" };

function relevanceFor(listing: Listing, target: TaxonDef | null, queryTokens: string[]): Relevance {
  const c = listing.classification;
  if (!target) {
    if (queryTokens.length === 0) return { kind: "unrelated" };
    const titleTokens = tokenize(`${listing.title} ${listing.variant?.label ?? ""}`);
    const all = queryTokens.every((qt) => findPhrase(titleTokens, [qt]) >= 0);
    return all ? { kind: "match", level: "text" } : { kind: "unrelated" };
  }
  const listingTaxon = c.taxonId ? getTaxon(c.taxonId) : undefined;
  if (target.rank === "family") {
    if (c.taxonId === target.id || listingTaxon?.family === target.genus) return { kind: "match", level: c.level };
    return { kind: "unrelated" };
  }
  if (target.rank === "genus") {
    if (listingTaxon && listingTaxon.genus === target.genus) return { kind: "match", level: c.level };
    return { kind: "unrelated" };
  }
  if (c.taxonId === target.id) return { kind: "match", level: c.level };
  // Different taxon: is it a look-alike worth showing separately?
  if (listingTaxon && listingTaxon.genus === target.genus) return { kind: "related" };
  const titleTokens = tokenize(listing.title);
  if (relatedNameTokens(target).some((p) => findPhrase(titleTokens, p) >= 0)) return { kind: "related" };
  return { kind: "unrelated" };
}

function dedupeKeys(l: Listing): string[] {
  return [
    `${l.sourceId}|${l.url}|${l.variant?.id ?? ""}`,
    // Same store listing the same plant twice (identical title, variant, price and stock).
    `${l.sourceId}|${normalizeForMatch(l.title)}|${normalizeForMatch(l.variant?.label ?? "")}|${l.price.amount}|${l.availability}`
  ];
}

const LEVEL_ORDER: Record<MatchLevel, number> = { cultivar: 0, species: 1, "genus-default": 2, genus: 3, text: 4, none: 5 };

function compare(sort: SortKey) {
  const priceOf = (i: ResultItem) => i.price.amount ?? Number.POSITIVE_INFINITY;
  const distOf = (i: ResultItem) => i.distanceKm ?? Number.POSITIVE_INFINITY;
  const timeOf = (i: ResultItem) => Date.parse(i.provenance.retrievedAt) || 0;
  return (a: ResultItem, b: ResultItem): number => {
    switch (sort) {
      case "distance":
        return distOf(a) - distOf(b) || priceOf(a) - priceOf(b);
      case "freshness":
        return timeOf(b) - timeOf(a) || priceOf(a) - priceOf(b);
      case "relevance":
        return (
          LEVEL_ORDER[a.classification.level] - LEVEL_ORDER[b.classification.level] ||
          availabilityRank(a) - availabilityRank(b) ||
          priceOf(a) - priceOf(b)
        );
      case "price":
      default:
        return priceOf(a) - priceOf(b) || distOf(a) - distOf(b);
    }
  };
}

function availabilityRank(i: Listing): number {
  return i.availability === "in_stock" ? 0 : i.availability === "unknown" ? 1 : 2;
}

const BUCKET_ORDER: Bucket[] = ["match", "location_unknown", "outside_radius", "related_species"];

export interface EvaluateResult {
  items: ResultItem[];
  counts: Record<Bucket, number>;
  hidden: HiddenCounts;
}

/**
 * Apply strict filters and bucket listings. A listing is a confirmed "match" only when every
 * active constraint is verified; unknown location is never treated as inside the radius.
 */
export function evaluateListings(
  listings: Listing[],
  request: SearchRequest,
  target: TaxonDef | null,
  now: Date = new Date()
): EvaluateResult {
  const hidden: HiddenCounts = {
    outOfStock: 0,
    overBudget: 0,
    underMinPrice: 0,
    priceUnknown: 0,
    accessories: 0,
    sizeMismatch: 0,
    sellerTypeMismatch: 0,
    unrelated: 0,
    duplicates: 0
  };
  const counts: Record<Bucket, number> = { match: 0, location_unknown: 0, outside_radius: 0, related_species: 0 };
  const queryTokens = target ? [] : tokenize(request.q).filter((t) => t.length >= 2);
  const seen = new Set<string>();
  const items: ResultItem[] = [];
  const staleBefore = now.getTime() - STALE_AFTER_HOURS * 3600_000;

  for (const listing of listings) {
    const keys = dedupeKeys(listing);
    if (keys.some((k) => seen.has(k))) {
      hidden.duplicates++;
      continue;
    }
    keys.forEach((k) => seen.add(k));

    if (listing.productKind === "accessory") {
      hidden.accessories++;
      continue;
    }
    const rel = relevanceFor(listing, target, queryTokens);
    if (rel.kind === "unrelated") {
      hidden.unrelated++;
      continue;
    }
    if (rel.kind === "related" && !request.includeRelated) {
      hidden.unrelated++;
      continue;
    }
    if (request.inStockOnly && listing.availability === "out_of_stock") {
      hidden.outOfStock++;
      continue;
    }
    const amount = listing.price.amount;
    if ((request.maxPrice !== null || request.minPrice !== null) && amount === null) {
      hidden.priceUnknown++;
      continue;
    }
    if (request.maxPrice !== null && amount !== null && amount > request.maxPrice) {
      hidden.overBudget++;
      continue;
    }
    if (request.minPrice !== null && amount !== null && amount < request.minPrice) {
      hidden.underMinPrice++;
      continue;
    }
    if (request.sizes.length > 0 && (!listing.size.sizeClass || !request.sizes.includes(listing.size.sizeClass))) {
      hidden.sizeMismatch++;
      continue;
    }
    if (request.sellerTypes.length > 0 && !request.sellerTypes.includes(listing.seller.type)) {
      hidden.sellerTypeMismatch++;
      continue;
    }

    let distanceKm: number | null = null;
    if (request.location && listing.seller.location) {
      distanceKm = Math.round(haversineKm(request.location, listing.seller.location) * 10) / 10;
    }

    let bucket: Bucket;
    if (rel.kind === "related") bucket = "related_species";
    else if (request.location && request.radiusKm !== null) {
      if (distanceKm === null) bucket = "location_unknown";
      else if (distanceKm > request.radiusKm) bucket = "outside_radius";
      else bucket = "match";
    } else bucket = "match";

    const flags = [...listing.flags];
    if (Date.parse(listing.provenance.retrievedAt) < staleBefore && !flags.includes("stale")) flags.push("stale");

    items.push({ ...listing, flags, bucket, distanceKm });
    counts[bucket]++;
  }

  const cmp = compare(request.sort);
  items.sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) || cmp(a, b));
  return { items, counts, hidden };
}
