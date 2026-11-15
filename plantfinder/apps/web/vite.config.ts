import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Static hosting (GitHub Pages) cannot send response headers, so the static build carries its CSP as a
 * <meta> tag. Server mode gets the same policy as a header from the API.
 */
function staticCsp(enabled: boolean): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "connect-src 'self' https://my-api.plantnet.org",
    "font-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ");
  return {
    name: "static-csp",
    transformIndexHtml(html) {
      return enabled ? html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`) : html;
    }
  };
}

export default defineConfig(({ mode }) => ({
  // Relative base: works at "/" (API server) and at "/<repo>/" (GitHub Pages project site).
  base: "./",
  plugins: [react(), staticCsp(mode === "static")],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" }
  },
  // No data: URIs: keeps the strict CSP (font-src 'self') intact.
  build: { outDir: mode === "static" ? "dist-static" : "dist", sourcemap: mode !== "static", chunkSizeWarningLimit: 600, assetsInlineLimit: 0 }
}));
