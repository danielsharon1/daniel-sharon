// Minimal static file server that mimics GitHub Pages for local checks and E2E:
//   node scripts/serve-static.mjs <dir> [port=8789] [basePath=/daniel-sharon/]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const [dirArg = "apps/web/dist-static", portArg = "8789", baseArg = "/daniel-sharon/"] = process.argv.slice(2);
const root = resolve(dirArg);
const base = baseArg.endsWith("/") ? baseArg : `${baseArg}/`;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".bin": "application/octet-stream", ".map": "application/json"
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (!url.pathname.startsWith(base)) {
    res.writeHead(302, { location: base }).end();
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-cache" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
}).listen(Number(portArg), "127.0.0.1", () => console.log(`static site on http://127.0.0.1:${portArg}${base}`));
