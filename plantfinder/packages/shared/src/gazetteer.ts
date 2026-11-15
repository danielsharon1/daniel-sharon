/** Israeli locality lookup (server-side; ~130 KB of data). Source: GeoNames, CC BY 4.0. */
import data from "./data/gazetteer.json" with { type: "json" };
import { normalizeForMatch } from "./text.js";
import type { GeoPoint } from "./types.js";

export interface Locality extends GeoPoint {
  id: number;
  en: string;
  he: string;
  population: number;
}

type Row = [number, string, string, number, number, number, string];

const LOCALITIES: Locality[] = (data.rows as Row[]).map(([id, en, he, lat, lon, population]) => ({ id, en, he, lat, lon, population }));
const KEYS: { key: string; loc: Locality; primary: boolean }[] = [];
(data.rows as Row[]).forEach((row, i) => {
  const loc = LOCALITIES[i]!;
  KEYS.push({ key: normalizeForMatch(row[2]), loc, primary: true }, { key: normalizeForMatch(row[1]), loc, primary: true });
  for (const alt of row[6].split("|")) if (alt) KEYS.push({ key: normalizeForMatch(alt), loc, primary: false });
});

export const GAZETTEER_ATTRIBUTION = data.source;

/** Exact lookup by Hebrew/English/alternate name; ties resolved by primary name, then population. */
export function findLocality(name: string): Locality | null {
  const q = normalizeForMatch(name);
  if (!q) return null;
  const hits = KEYS.filter((k) => k.key === q);
  if (hits.length === 0) return null;
  hits.sort((a, b) => Number(b.primary) - Number(a.primary) || b.loc.population - a.loc.population);
  return hits[0]!.loc;
}

/** Prefix autocomplete, most populous first. */
export function suggestLocalities(prefix: string, limit = 8): Locality[] {
  const q = normalizeForMatch(prefix);
  if (q.length < 2) return [];
  const seen = new Set<number>();
  const out: Locality[] = [];
  const ranked = KEYS.filter((k) => k.key.startsWith(q)).sort(
    (a, b) => Number(b.primary) - Number(a.primary) || b.loc.population - a.loc.population
  );
  for (const k of ranked) {
    if (seen.has(k.loc.id)) continue;
    seen.add(k.loc.id);
    out.push(k.loc);
    if (out.length >= limit) break;
  }
  return out;
}

export function localityCount(): number {
  return LOCALITIES.length;
}
