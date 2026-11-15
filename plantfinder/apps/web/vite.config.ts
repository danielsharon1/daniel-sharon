import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" }
  },
  // No data: URIs: keeps the strict CSP (font-src 'self') intact.
  build: { outDir: "dist", sourcemap: true, chunkSizeWarningLimit: 600, assetsInlineLimit: 0 }
});
