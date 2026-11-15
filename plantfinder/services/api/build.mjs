// Bundle the API (including @plantfinder/shared TS sources) into a single ESM file.
import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: true,
  packages: "external",
  // shared is a workspace TS package: bundle it instead of leaving it external
  plugins: [
    {
      name: "bundle-shared",
      setup(b) {
        b.onResolve({ filter: /^@plantfinder\/shared/ }, async (args) => {
          const sub = args.path.replace("@plantfinder/shared", "") || "/index";
          const file = sub === "/index" ? "index.ts" : `${sub.slice(1)}.ts`;
          return { path: new URL(`../../packages/shared/src/${file}`, import.meta.url).pathname };
        });
      }
    }
  ],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" }
});
console.log("built dist/server.js");
