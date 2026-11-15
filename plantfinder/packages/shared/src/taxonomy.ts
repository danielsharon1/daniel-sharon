import type { Classification, MatchLevel } from "./types.js";
import { TAXA, type TaxonDef, type TaxonRank } from "./taxonomy-data.js";
import { findPhrase, normalizeForMatch, tokenize } from "./text.js";

export { TAXA, type TaxonDef, type TaxonRank };

type NameKind = "name" | "default";

interface IndexedName {
  taxon: TaxonDef;
  tokens: string[];
  kind: NameKind;
  raw: string;
}

const LEVEL_RANK: Record<MatchLevel, number> = {
  cultivar: 5,
  species: 4,
  "genus-default": 3,
  genus: 2,
  text: 1,
  none: 0
};

function buildIndex(taxa: TaxonDef[]): IndexedName[] {
  const out: IndexedName[] = [];
  const seen = new Map<string, string>();
  for (const taxon of taxa) {
    const add = (raw: string, kind: NameKind) => {
      const tokens = tokenize(raw);
      if (tokens.length === 0) return;
      const key = tokens.join(" ");
      const prev = seen.get(key);
      if (prev && prev !== taxon.id) {
        throw new Error(`Ambiguous taxonomy name "${raw}" used by ${prev} and ${taxon.id}`);
      }
      if (prev === taxon.id) return;
      seen.set(key, taxon.id);
      out.push({ taxon, tokens, kind, raw });
    };
    add(taxon.scientificName, "name");
    for (const n of [...taxon.he, ...taxon.en, ...(taxon.aliases ?? [])]) add(n, "name");
    for (const n of taxon.defaultNames ?? []) add(n, "default");
  }
  // Longest names first so the most specific name wins.
  out.sort((a, b) => b.tokens.length - a.tokens.length);
  return out;
}

const INDEX = buildIndex(TAXA);
const BY_ID = new Map(TAXA.map((t) => [t.id, t]));

/**
 * Synthetic "<Genus> sp." taxa for genera that only appear through default names (e.g. Monstera).
 * They are not matched by name; classification falls back to them when a generic name is followed
 * by an unknown epithet ("מונסטרה B.M.F") so that a rare plant is never presented as the common species.
 */
function genusSpId(genus: string): string {
  return `${genus.toLowerCase()}-sp`;
}
for (const t of TAXA) {
  if (!t.defaultNames?.length) continue;
  const hasGenus = TAXA.some((g) => g.rank === "genus" && g.genus === t.genus);
  const id = genusSpId(t.genus);
  if (!hasGenus && !BY_ID.has(id)) {
    BY_ID.set(id, { id, scientificName: `${t.genus} sp.`, rank: "genus", genus: t.genus, he: [], en: [] });
  }
}

/** Words that may follow a generic name without implying a different species or cultivar. */
const GENERIC_FOLLOWERS = new Set(
  [
    "נאה", "יפה", "יפהפיה", "גדולה", "גדול", "קטנה", "קטן", "בינונית", "בינוני", "ענקית", "ענק", "בייבי", "מיני",
    "מבצע", "בעציץ", "עציץ", "בכלי", "כלי", "בכד", "כד", "קוטר", "גובה", "צמח", "ירוקה", "ירוק", "מטפסת", "מטפס",
    "לבית", "בית", "עם", "כולל", "חדש", "חדשה", "מומלץ", "מומלצת", "זן", "מקורית", "אמיתית", "בשלה", "בוגרת",
    "של", "או", "את", "גם", "לבחירה", "במגוון", "גדלים", "צבעים", "מתנה", "למשרד", "לבית",
    "דלי", "שתיל", "ענף", "ייחור", "מושרש", "עודפים", "יבוא", "מקומי", "ליטר", "סמ", "מ",
    "plant", "in", "pot", "large", "small", "medium", "big", "baby", "mini", "xs", "s", "m", "l", "xl", "xxl", "the", "with"
  ].map((w) => tokenize(w)[0] ?? w)
);

function followerIsUnknown(tokens: string[], start: number, length: number): boolean {
  const next = tokens[start + length];
  if (next === undefined) return false;
  if (/^\d/.test(next)) return false;
  return !GENERIC_FOLLOWERS.has(next);
}

export function getTaxon(id: string): TaxonDef | undefined {
  return BY_ID.get(id);
}

function levelFor(taxon: TaxonDef, kind: NameKind): MatchLevel {
  if (kind === "default") return "genus-default";
  return taxon.rank === "species" ? "species" : "genus";
}

const CONFIDENCE: Record<MatchLevel, number> = {
  cultivar: 0.97,
  species: 0.95,
  "genus-default": 0.75,
  genus: 0.5,
  text: 0.3,
  none: 0
};

const NONE: Classification = {
  taxonId: null,
  scientificName: null,
  cultivar: null,
  level: "none",
  confidence: 0,
  matchedName: null
};

interface CultivarEntry {
  taxon: TaxonDef;
  cultivar: string;
  tokens: string[];
  parents: string[][];
}

function buildCultivarIndex(taxa: TaxonDef[]): CultivarEntry[] {
  const out: CultivarEntry[] = [];
  for (const taxon of taxa) {
    if (!taxon.cultivars?.length) continue;
    const genusTaxa = taxa.filter((t) => t.rank === "genus" && t.genus === taxon.genus);
    const parents = [
      taxon.scientificName,
      ...taxon.he,
      ...taxon.en,
      ...(taxon.aliases ?? []),
      ...(taxon.defaultNames ?? []),
      ...genusTaxa.flatMap((g) => [...g.he, ...g.en])
    ]
      .map((n) => tokenize(n))
      .filter((t) => t.length > 0);
    for (const cv of taxon.cultivars) {
      for (const alias of [cv.name, ...cv.aliases]) {
        const tokens = tokenize(alias);
        if (tokens.length) out.push({ taxon, cultivar: cv.name, tokens, parents });
      }
    }
  }
  return out;
}

const CULTIVARS = buildCultivarIndex(TAXA);

/**
 * Classify free text (a product title, variant label or query) to a taxon.
 * The longest matching name wins; ties go to the more specific level, then to the earliest position.
 * A cultivar name only counts when its species (or genus) is also named in the same text,
 * and then it outranks a bare name of equal or shorter total length.
 */
export function classifyText(text: string): Classification {
  const tokens = tokenize(text);
  if (tokens.length === 0) return NONE;

  let best: { taxon: TaxonDef; raw: string; pos: number; level: MatchLevel; length: number; kind?: NameKind } | null = null;
  for (const entry of INDEX) {
    if (best && entry.tokens.length < best.length) break; // index sorted by length desc
    const pos = findPhrase(tokens, entry.tokens);
    if (pos < 0) continue;
    const level = levelFor(entry.taxon, entry.kind);
    if (
      !best ||
      LEVEL_RANK[level] > LEVEL_RANK[best.level] ||
      (LEVEL_RANK[level] === LEVEL_RANK[best.level] && pos < best.pos)
    ) {
      best = { taxon: entry.taxon, raw: entry.raw, pos, level, length: entry.tokens.length, kind: entry.kind };
    }
  }

  let cultivar: string | null = null;
  for (const cv of CULTIVARS) {
    if (cultivar && best?.taxon.id === cv.taxon.id) continue; // first cultivar of a taxon wins
    if (findPhrase(tokens, cv.tokens) < 0) continue;
    const parent = cv.parents
      .filter((p) => findPhrase(tokens, p) >= 0)
      .sort((a, b) => b.length - a.length)[0];
    if (!parent) continue;
    const length = cv.tokens.length + parent.length;
    // Same taxon: refine to the cultivar. Different taxon: only when strictly more specific (longer).
    if (!best || best.taxon.id === cv.taxon.id || length > best.length) {
      best = { taxon: cv.taxon, raw: `${parent.join(" ")} ${cv.tokens.join(" ")}`, pos: 0, level: "cultivar", length };
      cultivar = cv.cultivar;
    }
  }
  if (!best) return NONE;

  // Generic name + unknown epithet (and no recognised cultivar): only the genus is known.
  if (!cultivar && best.kind === "default" && followerIsUnknown(tokens, best.pos, best.length)) {
    const genusTaxon = TAXA.find((g) => g.rank === "genus" && g.genus === best!.taxon.genus) ?? BY_ID.get(genusSpId(best.taxon.genus));
    if (genusTaxon) {
      return {
        taxonId: genusTaxon.id,
        scientificName: genusTaxon.scientificName,
        cultivar: null,
        level: "genus",
        confidence: CONFIDENCE.genus,
        matchedName: best.raw
      };
    }
  }

  return {
    taxonId: best.taxon.id,
    scientificName: best.taxon.scientificName,
    cultivar,
    level: best.level,
    confidence: CONFIDENCE[best.level],
    matchedName: best.raw
  };
}

/** Terms sent to source-side search endpoints for a taxon (broad on purpose; results are re-classified locally). */
export function sourceSearchTerms(taxon: TaxonDef): string[] {
  if (taxon.searchTerms?.length) return [...taxon.searchTerms];
  const hebrew = [...taxon.he, ...(taxon.defaultNames ?? [])].filter((n) => /[א-ת]/.test(n));
  const shortestHe = hebrew.sort((a, b) => a.length - b.length)[0];
  const terms = new Set<string>();
  if (shortestHe) terms.add(shortestHe);
  if (taxon.rank !== "family") terms.add(taxon.genus.toLowerCase());
  return [...terms];
}

/** Names that appear in the titles of look-alike products (used to surface "related, different species" items). */
export function relatedNameTokens(taxon: TaxonDef): string[][] {
  return [...(taxon.defaultNames ?? []), ...taxon.he.slice(0, 1)]
    .map((n) => tokenize(n))
    .filter((t) => t.length === 1);
}

export interface TaxonSuggestion {
  id: string;
  scientificName: string;
  he: string;
  en: string;
  rank: TaxonRank;
  matched: string;
}

/** Prefix autocomplete over taxonomy names (Hebrew, English, scientific). */
export function suggestTaxa(prefix: string, limit = 8): TaxonSuggestion[] {
  const q = normalizeForMatch(prefix);
  if (q.length < 2) return [];
  const out: TaxonSuggestion[] = [];
  const used = new Set<string>();
  const consider = (startsOnly: boolean) => {
    for (const entry of INDEX) {
      if (out.length >= limit) return;
      if (used.has(entry.taxon.id)) continue;
      const name = entry.tokens.join(" ");
      const hit = startsOnly ? name.startsWith(q) : name.includes(q);
      if (!hit) continue;
      used.add(entry.taxon.id);
      out.push({
        id: entry.taxon.id,
        scientificName: entry.taxon.scientificName,
        he: entry.taxon.he[0] ?? entry.taxon.scientificName,
        en: entry.taxon.en[0] ?? entry.taxon.scientificName,
        rank: entry.taxon.rank,
        matched: entry.raw
      });
    }
  };
  consider(true);
  consider(false);
  return out;
}

/** Find a taxon by its scientific name (used to map photo-identification results). */
export function taxonByScientificName(name: string): TaxonDef | undefined {
  const c = classifyText(name);
  if (!c.taxonId) return undefined;
  const t = BY_ID.get(c.taxonId);
  if (!t) return undefined;
  // Only accept if the scientific genus matches, to avoid mapping by a coincidental common name.
  const genus = normalizeForMatch(name).split(" ")[0];
  return genus && normalizeForMatch(t.scientificName).includes(genus) ? t : undefined;
}
