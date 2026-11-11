import { expect, test } from "@playwright/test";

import { preparePage } from "./helpers";

const CASES = [
  { from: "/", to: "/es/", language: "es" },
  { from: "/es/", to: "/", language: "en" },
] as const;

for (const { from, to, language } of CASES) {
  test(`switching to ${language} from mid-page keeps the section in view`, async ({ page }) => {
    await preparePage(page, "light");
    await page.goto(from);
    await page.locator("#find-me").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      globalThis.scrollBy(0, 120);
    });
    await page.waitForFunction(() => globalThis.scrollY > 400);

    await page
      .locator(`[data-language-tabs] a[hreflang="${language}"]`)
      .evaluate((link: HTMLElement) => {
        link.click();
      });
    await page.waitForURL((url) => url.pathname === to);

    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBeGreaterThan(400);
    const top = await page
      .locator("#find-me")
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThan(400);
  });
}
