import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** True for loopback, private, link-local, CGNAT, multicast, documentation and other non-public ranges. */
export function isNonPublicIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isNonPublicIp(mapped[1]!);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x) || x.startsWith("64:ff9b:") || x.startsWith("2001:db8:") || x.startsWith("100::");
  }
  return true; // not an IP at all
}

export type Resolver = (host: string) => Promise<string[]>;

export const systemResolver: Resolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

/** Validate that a URL may be fetched server-side (SSRF guard). Throws with a user-safe message. */
export async function assertPublicUrl(raw: string, resolver: Resolver = systemResolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported_protocol");
  if (url.username || url.password) throw new Error("credentials_in_url");
  if (url.port && url.port !== "443" && url.port !== "80") throw new Error("unsupported_port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new Error("non_public_host");
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = await resolver(host);
    } catch {
      throw new Error("unresolvable_host");
    }
  }
  if (addresses.length === 0 || addresses.some(isNonPublicIp)) throw new Error("non_public_host");
  return url;
}
