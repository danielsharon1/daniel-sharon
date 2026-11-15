/**
 * Build the Israeli locality gazetteer from the GeoNames IL extract (CC BY 4.0).
 *   pnpm gazetteer [path/to/IL.txt path/to/alternatenames/IL.txt]
 * Without arguments both files are downloaded from download.geonames.org.
 * The preferred Hebrew name (alternateNames isPreferredName=1) is used as the display name.
 * Output: packages/shared/src/data/gazetteer.json  ([id, en, he, lat, lon, population, altNames])
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEEP = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC", "PPLS", "PPLL", "PPLF", "PPLG", "PPLR"]);

async function download(url: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "geonames-"));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GeoNames download failed: ${res.status} ${url}`);
  writeFileSync(join(dir, "f.zip"), Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", join(dir, "f.zip"), "IL.txt", "-d", dir]);
  return readFileSync(join(dir, "IL.txt"), "utf8");
}

async function loadSources(): Promise<[string, string]> {
  const [main, alt] = process.argv.slice(2);
  if (main && alt) return [readFileSync(main, "utf8"), readFileSync(alt, "utf8")];
  return [
    await download("https://download.geonames.org/export/dump/IL.zip"),
    await download("https://download.geonames.org/export/dump/alternatenames/IL.zip")
  ];
}

const isHebrew = (s: string) => /^[א-ת'"׳״\s\-–()]+$/.test(s) && /[א-ת]/.test(s);
const isLatin = (s: string) => /^[A-Za-z'`‘’\s\-.()]+$/.test(s);

const [text, altText] = await loadSources();
const NIQQUD = /[\u0591-\u05C7]/;
const preferredHe = new Map<string, string>();
const otherHe = new Map<string, string[]>();
for (const line of altText.split("\n")) {
  const f = line.split("\t");
  if (f[2] !== "he" || !f[3] || NIQQUD.test(f[3]) || f[7] === "1" || f[6] === "1") continue; // skip historic/colloquial
  if (f[4] === "1" && !preferredHe.has(f[1]!)) preferredHe.set(f[1]!, f[3]);
  else otherHe.set(f[1]!, [...(otherHe.get(f[1]!) ?? []), f[3]]);
}
const rows: [number, string, string, number, number, number, string][] = [];
for (const line of text.split("\n")) {
  const f = line.split("\t");
  if (f.length < 15 || f[6] !== "P" || !KEEP.has(f[7] ?? "")) continue;
  const alts = (f[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const latin = alts.filter(isLatin);
  const id = f[0]!;
  const hebrew = [...new Set([...(preferredHe.has(id) ? [preferredHe.get(id)!] : []), ...(otherHe.get(id) ?? []), ...alts.filter(isHebrew)])].filter(
    (n) => isHebrew(n) && !NIQQUD.test(n)
  );
  if (hebrew.length === 0) continue; // the UI is Hebrew-first; skip places without a Hebrew name
  const he = hebrew[0]!;
  const en = f[2] || f[1]!; // ASCII name ("Giv'at Hen") reads better than the diacritic form
  const altNames = [...new Set([...hebrew.slice(1), f[1]!, ...latin].filter((n) => n !== en && n !== he))].slice(0, 12);
  rows.push([Number(f[0]), en, he, Number(Number(f[4]).toFixed(5)), Number(Number(f[5]).toFixed(5)), Number(f[14]) || 0, altNames.join("|")]);
}
rows.sort((a, b) => b[5] - a[5]);
const out = join(root, "packages/shared/src/data/gazetteer.json");
writeFileSync(out, JSON.stringify({ source: "GeoNames IL extract (https://www.geonames.org, CC BY 4.0)", generatedAt: new Date().toISOString(), rows }));
console.log(`wrote ${rows.length} localities to ${out}`);
