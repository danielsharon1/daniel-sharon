import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Mirrors playwright.config.ts (pnpm build:static-demo encrypts the fixture snapshot with this passphrase).
const PASS = "e2e-demo-passphrase";
const BENCH = `?q=Monstera&city=${encodeURIComponent("נתניה")}&radiusKm=25&maxPrice=150`;

async function unlock(page: Page, url = BENCH) {
  await page.goto(url);
  await page.locator("#pass").fill(PASS);
  await page.getByRole("button", { name: "כניסה" }).click();
  await expect(page.locator(".summary__count, .empty").first()).toBeVisible({ timeout: 15_000 });
}

test("encrypted snapshot: wrong passphrase is refused, nothing is readable before unlock", async ({ page, request }) => {
  const bin = await (await request.get("data/index.bin")).body();
  expect(bin.toString("utf8")).not.toContain("מונסטרה");
  await page.goto(BENCH);
  await expect(page.locator(".summary__count")).toHaveCount(0);
  await page.locator("#pass").fill("not the passphrase");
  await page.getByRole("button", { name: "כניסה" }).click();
  await expect(page.locator(".unlock .notice--error")).toContainText("שגויה");
});

test("benchmark in the browser: same strict buckets as the API, DEMO label on recorded data", async ({ page }) => {
  await unlock(page);
  await expect(page.locator(".banner--demo")).toBeVisible();
  const matchLabels = page.locator(".bucket--match .label");
  for (let i = 0; i < (await matchLabels.count()); i++) {
    await expect(matchLabels.nth(i).locator("dd.unknown")).toHaveCount(0);
    expect(parseFloat(await matchLabels.nth(i).locator("dt:text('מרחק') + dd").innerText())).toBeLessThanOrEqual(25);
  }
  await expect(page.locator(".bucket--location_unknown .label").first()).toBeVisible();
  await expect(page.locator(".bucket--outside_radius .label").first()).toBeVisible();
  for (const href of await page.locator(".label__link").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) expect(href).toMatch(/^https:\/\//);
});

test("passphrase is remembered on this device and can be removed with Lock", async ({ page }) => {
  await unlock(page);
  await page.reload();
  await expect(page.locator(".summary__count")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "נעילה" }).click();
  await expect(page.locator("#pass")).toBeVisible();
});

test("Monstera / מונסטרה / Monstera deliciosa agree in the static build", async ({ page }) => {
  await unlock(page);
  const shape: string[] = [];
  for (const q of ["Monstera", "מונסטרה", "Monstera deliciosa"]) {
    await page.goto(`?q=${encodeURIComponent(q)}&city=Netanya&radiusKm=25&maxPrice=150`);
    await expect(page.locator(".summary__count")).toBeVisible({ timeout: 15_000 });
    shape.push(JSON.stringify(await page.locator(".bucket").evaluateAll((bs) => bs.map((b) => `${b.className}:${b.querySelectorAll(".label").length}`))));
  }
  expect(shape[1]).toBe(shape[0]);
  expect(shape[2]).toBe(shape[0]);
});

test("photo search explains that identification is not configured", async ({ page }) => {
  await unlock(page, "?");
  await page.getByRole("button", { name: "חיפוש לפי תמונה" }).click();
  await expect(page.getByRole("dialog")).toContainText("Pl@ntNet");
});

test("static build: accessibility and mobile layout", async ({ page, browser }) => {
  await unlock(page);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const m = await ctx.newPage();
  await m.goto(new URL(BENCH, page.url()).toString());
  await expect(m.locator("#pass")).toBeVisible();
  const { sw, vw } = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(vw);
  await ctx.close();
});
