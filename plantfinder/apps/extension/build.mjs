// Bundles the extension (incl. the shared search engine) into build/, validates least-privilege rules
// and produces a zip for the Chrome Web Store.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { build } from "esbuild";

const src = new URL("./src/", import.meta.url).pathname;
const out = new URL("./build/", import.meta.url).pathname;
const shared = new URL("../../packages/shared/src/", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));

const problems = [];
const allowed = new Set(["contextMenus", "storage", "activeTab"]);
for (const p of manifest.permissions ?? []) if (!allowed.has(p)) problems.push(`unexpected permission: ${p}`);
if (manifest.host_permissions?.length) problems.push("host_permissions must stay empty (the site/API is reached via CORS)");
if (manifest.content_scripts?.length) problems.push("content scripts are not allowed");
if (manifest.manifest_version !== 3) problems.push("manifest_version must be 3");

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
function scan(files) {
  for (const file of files.filter((f) => /\.(js|html|json)$/.test(f))) {
    const text = readFileSync(file, "utf8");
    if (/api[-_]?key\s*[=:]|PLANTNET_API_KEY|\b(sk|pk)[-_][A-Za-z0-9]{16,}/i.test(text)) problems.push(`possible secret in ${file}`);
    if (/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|\beval\(|new Function\(/.test(text)) problems.push(`unsafe DOM/code construct in ${file}`);
  }
}
scan(walk(src));
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: (p) => !p.endsWith(".js") || p.includes("_locales") });
await build({
  entryPoints: ["background.js", "popup.js", "identify.js", "options.js"].map((f) => join(src, f)),
  outdir: out,
  bundle: true,
  format: "esm",
  splitting: true, // one shared chunk instead of four copies of the search engine
  chunkNames: "chunks/[name]-[hash]",
  target: "chrome116",
  minify: false, // readable code for Web Store review
  legalComments: "none",
  alias: {
    "@plantfinder/shared/gazetteer": join(shared, "gazetteer.ts"),
    "@plantfinder/shared": join(shared, "index.ts")
  }
});
scan(walk(out)); // the bundle must pass the same checks
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
try {
  rmSync(new URL("./plantfinder-extension.zip", import.meta.url).pathname, { force: true });
  execFileSync("zip", ["-q", "-r", "../plantfinder-extension.zip", "."], { cwd: out });
  console.log("built build/ and plantfinder-extension.zip");
} catch {
  console.log("built build/ (zip CLI not available; zip the folder manually for the Web Store)");
}
if (!existsSync(join(out, "manifest.json"))) process.exit(1);
