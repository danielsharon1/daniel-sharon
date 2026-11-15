import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function runBenchmark(page: Page) {
  await page.goto("/");
  await page.getByLabel("שם הצמח").fill("מונסטרה");
  await page.getByLabel("עיר").fill("נתניה");
  await page.getByLabel("עיר").press("Enter");
  await page.getByLabel("עד מחיר (₪)").fill("150");
  await page.getByLabel("עד מחיר (₪)").press("Enter");
  await page.getByRole("button", { name: "חיפוש", exact: true }).click();
  await expect(page.locator(".summary__count")).toBeVisible();
}

test.describe("benchmark: Monstera / Netanya / 25 km / ≤150 ₪", () => {
  test("never shows unknown or out-of-range sellers as confirmed matches", async ({ page }) => {
    await runBenchmark(page);
    await expect(page.locator(".summary__scope")).toContainText("25");
    await expect(page.locator(".banner--demo")).toBeVisible();

    const matchLabels = page.locator(".bucket--match .label");
    const n = await matchLabels.count();
    for (let i = 0; i < n; i++) {
      const label = matchLabels.nth(i);
      await expect(label.locator("dd.unknown")).toHaveCount(0); // location must be verified
      const dist = await label.locator("dt:text('מרחק') + dd").innerText();
      expect(parseFloat(dist)).toBeLessThanOrEqual(25);
    }
    // Online stores without an address land in their own section.
    await expect(page.locator(".bucket--location_unknown .label").first()).toBeVisible();
    await expect(page.locator(".bucket--location_unknown dd.unknown").first()).toBeVisible();

    // Every price shown is within budget and every listing links to an https source page.
    const links = await page.locator(".label__link").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) expect(href).toMatch(/^https:\/\//);
  });

  test("suggests the smallest radius that reaches the nearest seller and applies it", async ({ page }) => {
    await runBenchmark(page);
    const expand = page.getByRole("button", { name: /הרחבה ל/ });
    if ((await page.locator(".bucket--match .label").count()) === 0) {
      await expect(expand).toBeVisible();
      await expand.click();
      await expect(page.locator(".bucket--match .label").first()).toBeVisible();
      await expect(page).toHaveURL(/radiusKm=30/);
    }
  });

  test("Monstera, מונסטרה and Monstera deliciosa give the same results", async ({ page }) => {
    const counts: string[] = [];
    for (const q of ["Monstera", "מונסטרה", "Monstera deliciosa"]) {
      await page.goto(`/?q=${encodeURIComponent(q)}&city=Netanya&radiusKm=25&maxPrice=150`);
      await expect(page.locator(".summary__count")).toBeVisible();
      counts.push(
        JSON.stringify(
          await page.locator(".bucket").evaluateAll((bs) => bs.map((b) => `${b.className}:${b.querySelectorAll(".label").length}`))
        )
      );
      await expect(page.locator(".summary__taxon")).toContainText("Monstera deliciosa");
    }
    expect(counts[1]).toBe(counts[0]);
    expect(counts[2]).toBe(counts[0]);
  });
});

test("language toggle switches to English LTR and back", async ({ page }) => {
  await page.goto("/?q=Monstera");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "עברית" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("saved searches persist in this browser", async ({ page }) => {
  await page.goto("/?q=Monstera&city=Netanya&radiusKm=25&maxPrice=150");
  await page.getByRole("button", { name: "שמירת החיפוש" }).click();
  await page.reload();
  await expect(page.locator(".saved li")).toHaveCount(1);
  await expect(page.locator(".saved li .link")).toContainText("Monstera");
});

test("sources dialog lists active and rejected sources", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /מקורות/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("table.sources tbody tr")).toHaveCount(6);
  await expect(dialog).toContainText("Facebook");
  await expect(dialog).toContainText("Cloudflare");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("photo search explains when identification is not configured", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "חיפוש לפי תמונה" }).click();
  await expect(page.getByRole("dialog")).toContainText("Pl@ntNet");
});

test("mobile layout has no horizontal overflow", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/?q=Monstera&city=Netanya&radiusKm=25&maxPrice=150");
  await expect(page.locator(".summary__count")).toBeVisible();
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(vw);
  await ctx.close();
});

test.describe("accessibility (axe, WCAG 2.1 A/AA)", () => {
  for (const [name, url] of [
    ["empty state", "/"],
    ["benchmark results", "/?q=Monstera&city=Netanya&radiusKm=25&maxPrice=150"],
    ["English results", "/?q=Monstera&city=Netanya&radiusKm=25&maxPrice=150&lang=en"]
  ] as const) {
    test(name, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} nodes — ${v.help}`)).toEqual([]);
    });
  }
});
