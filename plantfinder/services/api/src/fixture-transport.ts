import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SourceHttpError, type Transport } from "./http.js";
import { trimPayload } from "./fixture-trim.js";

interface ManifestEntry {
  file: string;
  fetchedAt: string;
  status: number;
}
type Manifest = Record<string, ManifestEntry>;

function fileFor(url: string): string {
  const host = new URL(url).host.replace(/[^a-z0-9.-]/gi, "_");
  return `${host}/${createHash("sha1").update(url).digest("hex").slice(0, 16)}.json`;
}

function loadManifest(dir: string): Manifest {
  const p = join(dir, "manifest.json");
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Manifest) : {};
}

/** Serves real, previously recorded source responses. Everything it returns is labeled DEMO downstream. */
export class FixtureTransport implements Transport {
  readonly kind = "fixture" as const;
  private readonly manifest: Manifest;
  constructor(private readonly dir: string) {
    this.manifest = loadManifest(dir);
  }
  async getJson(url: string) {
    const entry = this.manifest[url];
    if (!entry) throw new SourceHttpError(`No recorded fixture for ${url}`, 404);
    const json = JSON.parse(readFileSync(join(this.dir, entry.file), "utf8")) as unknown;
    return { status: entry.status, json, headers: {}, fetchedAt: entry.fetchedAt };
  }
}

/** Wraps a live transport and writes every response into the fixture directory. */
export class RecordingTransport implements Transport {
  readonly kind = "live" as const;
  private readonly manifest: Manifest;
  constructor(
    private readonly inner: Transport,
    private readonly dir: string
  ) {
    this.manifest = loadManifest(dir);
  }
  async getJson(url: string) {
    const res = await this.inner.getJson(url);
    const file = fileFor(url);
    mkdirSync(join(this.dir, file.split("/")[0]!), { recursive: true });
    writeFileSync(join(this.dir, file), JSON.stringify(trimPayload(url, res.json)));
    this.manifest[url] = { file, fetchedAt: res.fetchedAt, status: res.status };
    writeFileSync(join(this.dir, "manifest.json"), JSON.stringify(this.manifest, null, 1));
    return res;
  }
}
