import { parseRobots, type RobotsPolicy } from "./robots.js";

/** A JSON-over-HTTP transport. Live = polite network client; fixture = recorded responses. */
export interface Transport {
  readonly kind: "live" | "fixture";
  getJson(url: string): Promise<TransportResult>;
}

export interface TransportResult {
  status: number;
  json: unknown;
  headers: Record<string, string>;
  fetchedAt: string;
  /** Served from cache within TTL. */
  fromCache?: boolean;
  /** Live fetch failed; an older cached copy was served instead (error message kept). */
  staleFallback?: string;
}

export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedError";
  }
}

export class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

export interface LiveTransportOptions {
  userAgent: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Polite live client:
 *  - identifies itself with a stable User-Agent (never rotates or spoofs a browser)
 *  - obeys robots.txt (cached 24h) before every request
 *  - one request at a time per host, with a minimum interval
 *  - detects bot challenges / 403 / 429 and opens a circuit instead of retrying
 */
export class LiveTransport implements Transport {
  readonly kind = "live" as const;
  private readonly robots = new Map<string, { policy: RobotsPolicy; until: number }>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly lastAt = new Map<string, number>();
  private readonly circuit = new Map<string, { until: number; reason: string }>();
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: LiveTransportOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async throttled<T>(host: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(host) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(async () => {
      const wait = (this.lastAt.get(host) ?? 0) + (this.opts.minIntervalMs ?? 700) - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        this.lastAt.set(host, Date.now());
      }
    });
    this.queues.set(host, run);
    return run;
  }

  private async rawGet(url: URL, accept: string): Promise<{ status: number; text: string; headers: Record<string, string> }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 12_000);
    try {
      const res = await this.fetchImpl(url, {
        headers: { "user-agent": this.opts.userAgent, accept, "accept-language": "he,en;q=0.8" },
        redirect: "follow",
        signal: ctrl.signal
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      const buf = await res.arrayBuffer();
      if (buf.byteLength > (this.opts.maxBytes ?? 8_000_000)) throw new SourceHttpError("Response too large", res.status);
      return { status: res.status, text: new TextDecoder().decode(buf), headers };
    } finally {
      clearTimeout(timer);
    }
  }

  private async robotsFor(origin: URL): Promise<RobotsPolicy> {
    const cached = this.robots.get(origin.host);
    if (cached && cached.until > Date.now()) return cached.policy;
    const res = await this.rawGet(new URL("/robots.txt", origin), "text/plain");
    if (looksLikeChallenge(res.status, res.headers, res.text)) throw new BlockedError(`Bot challenge at ${origin.host}/robots.txt`);
    // 4xx = no restrictions (RFC 9309 §2.3.1.3); 5xx = assume complete disallow.
    const policy =
      res.status >= 500 ? { isAllowed: () => false } : res.status >= 400 ? { isAllowed: () => true } : parseRobots(res.text, this.opts.userAgent);
    this.robots.set(origin.host, { policy, until: Date.now() + 24 * 3600_000 });
    return policy;
  }

  async getJson(urlString: string) {
    const url = new URL(urlString);
    if (url.protocol !== "https:") throw new SourceHttpError("Only https sources are allowed", 0);
    const open = this.circuit.get(url.host);
    if (open && open.until > Date.now()) throw new BlockedError(`Circuit open for ${url.host}: ${open.reason}`);

    return this.throttled(url.host, async () => {
      const robots = await this.robotsFor(url);
      if (!robots.isAllowed(url.pathname + url.search)) throw new BlockedError(`robots.txt disallows ${url.pathname}`);
      const res = await this.rawGet(url, "application/json");
      if (looksLikeChallenge(res.status, res.headers, res.text)) {
        this.circuit.set(url.host, { until: Date.now() + 3600_000, reason: "bot challenge" });
        throw new BlockedError(`Bot challenge from ${url.host}`);
      }
      if (res.status === 429 || res.status === 403) {
        const retry = Number(res.headers["retry-after"]) || 1800;
        this.circuit.set(url.host, { until: Date.now() + retry * 1000, reason: `HTTP ${res.status}` });
        throw new BlockedError(`HTTP ${res.status} from ${url.host}`);
      }
      if (res.status >= 400) throw new SourceHttpError(`HTTP ${res.status} from ${url.host}`, res.status);
      let json: unknown;
      try {
        json = JSON.parse(res.text);
      } catch {
        throw new SourceHttpError(`Non-JSON response from ${url.host}`, res.status);
      }
      return { status: res.status, json, headers: res.headers, fetchedAt: new Date().toISOString() };
    });
  }
}

export function looksLikeChallenge(status: number, headers: Record<string, string>, body: string): boolean {
  if (headers["cf-mitigated"] === "challenge") return true;
  if ((status === 403 || status === 503) && /Just a moment|challenge-platform|cf-chl|captcha/i.test(body.slice(0, 5000))) return true;
  return false;
}
