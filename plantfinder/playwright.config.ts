import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "off" },
  webServer: {
    // The production bundle in fixture mode: real recorded source data, labeled DEMO, no network needed.
    command: "node services/api/dist/server.js",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), HOST: "127.0.0.1", PF_DATA_MODE: "fixture", PF_ALLOWED_ORIGINS: "chrome-extension://*" },
    timeout: 30_000
  },
  projects: [
    { name: "web", testMatch: /web\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "extension", testMatch: /extension\.spec\.ts/ }
  ]
});
