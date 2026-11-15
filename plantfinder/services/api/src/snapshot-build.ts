/**
 * Build the static-site data snapshot (run by the scheduled GitHub Actions workflow, or locally).
 *
 *   PF_SNAPSHOT_PASSPHRASE=... tsx src/snapshot-build.ts --out ../../apps/web/dist-static \
 *       [--from-fixtures] [--previous https://<user>.github.io/<repo>/] [--health ../../docs/source-health.md]
 *
 * - Live mode fetches each enabled source's full public catalog (robots-checked, throttled, one host at a time).
 * - --from-fixtures builds from the recorded snapshots instead (labelled DEMO; used by tests and offline demos).
 * - --previous: if a source fails, keep that source's listings from the previously published snapshot when they
 *   are younger than 72 h (status "carried_over"; listings keep their original check time).
 * - The personal pilot policy REQUIRES a passphrase: catalog data is never published unencrypted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  compactListing,
  decodeSnapshot,
  encodeSnapshot,
  resolveQuery,
  SNAPSHOT_VERSION,
  type CompactListing,
  type Listing,
  type SnapshotIndex,
  type SnapshotMeta,
  type SnapshotSource
} from "@plantfinder/shared";
import { loadConfig } from "./config.js";
import { LiveTransport, BlockedError } from "./http.js";
import { FixtureTransport } from "./fixture-transport.js";
import { SearchService } from "./search-service.js";

const CARRY_OVER_MAX_AGE_MS = 72 * 3600_000;
const SOURCE_TIMEOUT_MS = 15 * 60_000;
const FIXTURE_QUERIES = [
  "Monstera", "פוטוס", "פיקוס כינורי", "סנסוויריה", "זמיוקולקס", "קלתאה", "אלוקסיה", "אגלונמה", "פילודנדרון",
  "הויה", "פפרומיה", "סטרליציה", "שפלרה", "דרצנה", "בגוניה", "סחלב", "סינגוניום", "אנטוריום", "ספטיפילום",
  "יוקה", "קרסולה", "אלוורה", "קקטוס"
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error(`timeout after ${ms / 1000}s`)), ms)))]);
  } finally {
    clearTimeout(t);
  }
}

async function loadPrevious(base: string, passphrase: string | null): Promise<SnapshotIndex | null> {
  try {
    const root = base.endsWith("/") ? base : `${base}/`;
    const metaRes = await fetch(new URL("data/meta.json", root));
    const binRes = await fetch(new URL("data/index.bin", root));
    if (!metaRes.ok || !binRes.ok) return null;
    return await decodeSnapshot((await metaRes.json()) as SnapshotMeta, new Uint8Array(await binRes.arrayBuffer()), passphrase);
  } catch (e) {
    console.warn(`previous snapshot unavailable: ${(e as Error).message}`);
    return null;
  }
}

const config = loadConfig();
const out = resolve(arg("out") ?? "dist-static");
const fromFixtures = flag("from-fixtures");
const passphrase = process.env.PF_SNAPSHOT_PASSPHRASE?.trim() || null;

if (config.sourcePolicy === "personal" && !passphrase) {
  console.error(
    "PF_SNAPSHOT_PASSPHRASE is required for the personal pilot policy: the nurseries' terms do not allow publishing their catalog data openly.\n" +
      "Set a passphrase of at least 12 characters (GitHub: Settings → Secrets and variables → Actions → PF_SNAPSHOT_PASSPHRASE)."
  );
  process.exit(2);
}

const transport = fromFixtures ? new FixtureTransport(config.fixturesDir) : new LiveTransport({ userAgent: config.userAgent, minIntervalMs: 1200 });
const service = new SearchService({ transport, sourcePolicy: config.sourcePolicy });
const previous = !fromFixtures && arg("previous") ? await loadPrevious(arg("previous")!, passphrase) : null;

const runs = await Promise.all(
  service.adapters.map(async (adapter) => {
    const started = Date.now();
    try {
      let listings: Listing[];
      let fetchedAt: string;
      if (fromFixtures) {
        const byId = new Map<string, Listing>();
        let oldest = new Date().toISOString();
        for (const q of FIXTURE_QUERIES) {
          const terms = resolveQuery(q).resolved.sourceTerms;
          try {
            const r = await adapter.search(terms);
            r.listings.forEach((l) => byId.set(l.id, l));
            if (r.retrievedAt < oldest) oldest = r.retrievedAt;
          } catch {
            // not every query was recorded for every source
          }
        }
        listings = [...byId.values()];
        fetchedAt = oldest;
      } else {
        const r = await withTimeout(adapter.fetchCatalog(), SOURCE_TIMEOUT_MS);
        listings = r.listings;
        fetchedAt = r.retrievedAt;
      }
      const plants = listings.filter((l) => l.productKind !== "accessory");
      console.log(`${adapter.source.id}: ${listings.length} listings, ${plants.length} kept (non-accessory), ${((Date.now() - started) / 1000).toFixed(1)}s`);
      const compact: CompactListing[] = plants.map(compactListing);
      return { id: adapter.source.id, status: "ok" as const, message: null as string | null, fetchedAt: fetchedAt as string | null, listings: compact };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const prev = previous?.listings.filter((l) => l.sourceId === adapter.source.id) ?? [];
      const prevRun = previous?.sources.find((s) => s.id === adapter.source.id)?.run;
      const fresh = prevRun?.fetchedAt && Date.now() - Date.parse(prevRun.fetchedAt) < CARRY_OVER_MAX_AGE_MS;
      if (prev.length && fresh) {
        console.warn(`${adapter.source.id}: FAILED (${message}); carrying over ${prev.length} listings from ${prevRun!.fetchedAt}`);
        return { id: adapter.source.id, status: "carried_over" as const, message, fetchedAt: prevRun!.fetchedAt, listings: prev };
      }
      console.warn(`${adapter.source.id}: FAILED (${message})`);
      return { id: adapter.source.id, status: e instanceof BlockedError ? ("blocked" as const) : ("error" as const), message, fetchedAt: null, listings: [] as CompactListing[] };
    }
  })
);

const runById = new Map(runs.map((r) => [r.id, r]));
const sources: SnapshotSource[] = service.sourcesInfo().map((info) => {
  const run = runById.get(info.id);
  return {
    ...info,
    lastRefreshedAt: run?.fetchedAt ?? null,
    run: run
      ? { status: run.status, message: run.message, fetchedAt: run.fetchedAt, listings: run.listings.length }
      : { status: "skipped", message: info.disabledReason, fetchedAt: null, listings: 0 }
  };
});

const seen = new Set<string>();
const listings = runs.flatMap((r) => r.listings).filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));

if (listings.length === 0) {
  console.error("No listings from any source: refusing to publish an empty snapshot.");
  process.exit(1);
}

const index: SnapshotIndex = {
  version: SNAPSHOT_VERSION,
  generatedAt: new Date().toISOString(),
  sourcePolicy: config.sourcePolicy,
  dataMode: fromFixtures ? "fixture" : "live",
  sources,
  listings
};
const { meta, bytes } = await encodeSnapshot(index, passphrase);
mkdirSync(join(out, "data"), { recursive: true });
writeFileSync(join(out, "data", "meta.json"), JSON.stringify(meta, null, 1));
writeFileSync(join(out, "data", "index.bin"), bytes);
const fresh = runs.filter((r) => r.status === "ok").length;
const carried = runs.filter((r) => r.status === "carried_over").length;
console.log(
  `snapshot: ${listings.length} listings; ${fresh}/${runs.length} sources fresh, ${carried} carried over; ${(bytes.length / 1024).toFixed(0)} KB${meta.encryption ? " (encrypted)" : ""} → ${join(out, "data")}`
);

const healthFile = arg("health");
if (healthFile) {
  const rows = sources
    .filter((s) => s.enabled)
    .map((s) => `| ${s.name.he} | ${s.run.status} | ${s.run.listings} | ${s.run.fetchedAt ?? "—"} | ${s.run.message?.replace(/\|/g, "/") ?? ""} |`);
  writeFileSync(
    resolve(healthFile),
    [
      "# Source health (auto-generated)",
      "",
      `Last snapshot: ${index.generatedAt} (${index.dataMode}). Updated weekly by the site workflow; contains counts only, no catalog content.`,
      "",
      "| Source | Status | Listings | Checked | Message |",
      "|---|---|---|---|---|",
      ...rows,
      ""
    ].join("\n")
  );
}

const failed = runs.filter((r) => r.status !== "ok");
if (failed.length) console.warn(`warning: ${failed.length} source(s) not refreshed: ${failed.map((f) => `${f.id} (${f.status})`).join(", ")}`);
if (fresh === 0) {
  // Nothing new: fail the job so the owner is notified; the last published site stays online.
  console.error("No source could be refreshed in this run.");
  process.exit(1);
}
