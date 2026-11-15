import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The `chrome` API exists inside the extension service worker where sw.evaluate() runs.
declare const chrome: {
  contextMenus: { create(props: Record<string, unknown>, cb: () => void): void };
  runtime: { lastError?: unknown };
};

const EXT = join(process.cwd(), "apps/extension/build");
const API = "http://127.0.0.1:8788";

let ctx: BrowserContext;
let extId: string;

test.beforeAll(async () => {
  ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "pf-ext-")), {
    channel: "chromium", // full Chromium build: supports extensions in headless mode
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  extId = new URL(sw.url()).host;
  // Point the extension at the test server.
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/options.html`);
  await page.locator("#apiBase").fill(API);
  await page.locator("#form button").click();
  await expect(page.locator("#status")).toContainText(/נשמר|Saved/);
  await page.close();
});

test.afterAll(async () => ctx?.close());

test("manifest is MV3 with least-privilege permissions and no host access", () => {
  const m = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));
  expect(m.manifest_version).toBe(3);
  expect([...m.permissions].sort()).toEqual(["activeTab", "contextMenus", "storage"]);
  expect(m.host_permissions ?? []).toEqual([]);
  expect(m.content_scripts ?? []).toEqual([]);
});

test("service worker loads and registers the context menus", async () => {
  const sw = ctx.serviceWorkers()[0]!;
  expect(sw.url()).toContain("background.js");
  // contextMenus has no list API; creating an existing id fails, which proves registration.
  const duplicates = await sw.evaluate(async () => {
    const ids = ["pf-image", "pf-selection", "pf-page"];
    const results: string[] = [];
    for (const id of ids) {
      await new Promise<void>((resolve) => {
        chrome.contextMenus.create({ id, title: "x", contexts: ["page"] }, () => {
          results.push(chrome.runtime.lastError ? "exists" : "new");
          resolve();
        });
      });
    }
    return results;
  });
  expect(duplicates).toEqual(["exists", "exists", "exists"]);
});

test("popup searches the shared API and links to sources", async () => {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await page.locator("#q").fill("מונסטרה");
  await page.locator("#city").fill("נתניה");
  await page.locator("#max").fill("150");
  await page.locator("#form button[type=submit]").click();
  await expect(page.locator("#status")).toContainText(/הדגמה|Demo/);
  await expect(page.locator("#results li").first()).toBeVisible();
  const hrefs = await page.locator("#results li a").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  for (const h of hrefs) expect(h).toMatch(/^https:\/\//);
  await page.close();
});

test("image identification page degrades gracefully without a provider key", async () => {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/identify.html?imageUrl=${encodeURIComponent("https://example.com/plant.jpg")}`);
  await expect(page.locator("#status")).toContainText("Pl@ntNet");
  await expect(page.locator("#fallback")).toBeVisible();
  await page.close();
});

test("image identification refuses non-web images", async () => {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/identify.html?unsupported=1`);
  await expect(page.locator("#status .error")).toBeVisible();
  await page.close();
});
