import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import type { Transport, TransportResult } from "./http.js";

interface Entry {
  result: TransportResult;
  storedAt: number;
}

export interface CachingOptions {
  ttlMsFor(url: string): number;
  /** Serve an expired copy if the live fetch fails and the copy is younger than this. */
  maxStaleMs: number;
  persistPath?: string;
  maxEntries?: number;
}

/**
 * URL-keyed response cache in front of a transport. Keeps source load low (sources are
 * queried on demand, then reused for the TTL) and lets the app degrade to clearly labeled
 * stale data when a source is temporarily down.
 */
export class CachingTransport implements Transport {
  readonly kind: "live" | "fixture";
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<TransportResult>>();
  private writeTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly inner: Transport,
    private readonly opts: CachingOptions
  ) {
    this.kind = inner.kind;
    if (opts.persistPath && existsSync(opts.persistPath)) {
      try {
        const data = JSON.parse(readFileSync(opts.persistPath, "utf8")) as [string, Entry][];
        for (const [k, v] of data) this.entries.set(k, v);
      } catch {
        // corrupt cache file: start empty
      }
    }
  }

  lastFetchedAt(prefix: string): string | null {
    let best: string | null = null;
    for (const [url, e] of this.entries) if (url.startsWith(prefix) && (!best || e.result.fetchedAt > best)) best = e.result.fetchedAt;
    return best;
  }

  async getJson(url: string): Promise<TransportResult> {
    const now = Date.now();
    const hit = this.entries.get(url);
    if (hit && now - hit.storedAt < this.opts.ttlMsFor(url)) return { ...hit.result, fromCache: true };
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const p = (async () => {
      try {
        const result = await this.inner.getJson(url);
        this.entries.set(url, { result, storedAt: Date.now() });
        this.evict();
        this.schedulePersist();
        return result;
      } catch (err) {
        if (hit && now - hit.storedAt < this.opts.maxStaleMs) {
          return { ...hit.result, fromCache: true, staleFallback: err instanceof Error ? err.message : String(err) };
        }
        throw err;
      } finally {
        this.inflight.delete(url);
      }
    })();
    this.inflight.set(url, p);
    return p;
  }

  private evict() {
    const max = this.opts.maxEntries ?? 2000;
    while (this.entries.size > max) {
      const oldest = [...this.entries.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt)[0];
      if (!oldest) break;
      this.entries.delete(oldest[0]);
    }
  }

  private schedulePersist() {
    const path = this.opts.persistPath;
    if (!path || this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      try {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(`${path}.tmp`, JSON.stringify([...this.entries.entries()]));
        renameSync(`${path}.tmp`, path);
      } catch {
        // persistence is best-effort
      }
    }, 2000);
    this.writeTimer.unref();
  }
}
