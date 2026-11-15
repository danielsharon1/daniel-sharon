import { taxonByScientificName, type IdentifyCandidate } from "@plantfinder/shared";
import { assertPublicUrl, systemResolver, type Resolver } from "./net-guard.js";

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Identify the image format from magic bytes; the client-supplied content type is not trusted. */
export function sniffImage(buf: Uint8Array): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return "image/png";
  if (buf.length >= 12 && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export class ImageError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400
  ) {
    super(code);
  }
}

export function validateImage(buf: Uint8Array): ImageMime {
  if (buf.length === 0) throw new ImageError("empty_image");
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageError("image_too_large", 413);
  const mime = sniffImage(buf);
  if (!mime) throw new ImageError("unsupported_image_type", 415);
  return mime;
}

export interface IdentifyProvider {
  readonly name: string;
  identify(image: Uint8Array, mime: ImageMime): Promise<IdentifyCandidate[]>;
}

interface PlantNetResult {
  score: number;
  species: {
    scientificNameWithoutAuthor: string;
    commonNames?: string[];
  };
}

/** Pl@ntNet identification API (https://my.plantnet.org). The key never leaves the server. */
export class PlantNetProvider implements IdentifyProvider {
  readonly name = "Pl@ntNet";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async identify(image: Uint8Array, mime: ImageMime): Promise<IdentifyCandidate[]> {
    const form = new FormData();
    form.append("images", new Blob([image as BlobPart], { type: mime }), `upload.${mime.split("/")[1]}`);
    form.append("organs", "auto");
    const url = `https://my-api.plantnet.org/v2/identify/all?include-related-images=false&nb-results=5&lang=en&api-key=${encodeURIComponent(this.apiKey)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await this.fetchImpl(url, { method: "POST", body: form, signal: ctrl.signal });
      if (res.status === 404) return []; // Pl@ntNet: "Species not found"
      if (res.status === 401 || res.status === 403) throw new ImageError("identify_provider_auth", 502);
      if (res.status === 429) throw new ImageError("identify_quota_exceeded", 503);
      if (!res.ok) throw new ImageError("identify_provider_error", 502);
      const data = (await res.json()) as { results?: PlantNetResult[] };
      return (data.results ?? []).slice(0, 5).map((r) => {
        const taxon = taxonByScientificName(r.species.scientificNameWithoutAuthor);
        return {
          scientificName: r.species.scientificNameWithoutAuthor,
          commonNames: (r.species.commonNames ?? []).slice(0, 3),
          score: Math.max(0, Math.min(1, r.score)),
          taxonId: taxon?.id ?? null,
          he: taxon?.he[0] ?? null
        };
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Download an image by URL for identification, with SSRF protection and size/type limits. */
export async function fetchImageSafely(
  raw: string,
  opts: { resolver?: Resolver; fetchImpl?: typeof fetch; userAgent: string }
): Promise<{ bytes: Uint8Array; mime: ImageMime }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop < 3; hop++) {
    const url = await assertPublicUrl(current, opts.resolver ?? systemResolver).catch((e: Error) => {
      throw new ImageError(e.message);
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetchImpl(url, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": opts.userAgent, accept: "image/*" } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new ImageError("bad_redirect");
        current = new URL(loc, url).toString();
        continue;
      }
      if (!res.ok || !res.body) throw new ImageError("image_fetch_failed", 502);
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_IMAGE_BYTES) throw new ImageError("image_too_large", 413);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          throw new ImageError("image_too_large", 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        bytes.set(c, off);
        off += c.byteLength;
      }
      return { bytes, mime: validateImage(bytes) };
    } catch (e) {
      if (e instanceof ImageError) throw e;
      throw new ImageError("image_fetch_failed", 502);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ImageError("too_many_redirects");
}
