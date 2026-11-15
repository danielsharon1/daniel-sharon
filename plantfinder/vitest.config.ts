import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "services/**/*.test.ts", "apps/extension/**/*.test.ts", "eval/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000
  }
});
