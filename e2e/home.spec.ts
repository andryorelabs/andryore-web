import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";

const HOME_ROUTES = ["/", "/es/"] as const;

test.describe("home anchors", () => {
  for (const route of HOME_ROUTES) {
    test(`the products anchor scrolls to the section on ${route}`, async ({ page }) => {
      await preparePage(page, "light");
      await page.goto(`${route}#products`, { waitUntil: "load" });
      const section = page.locator("#products");
      await expect(section).toBeInViewport();
      const top = await section.evaluate((element) => element.getBoundingClientRect().top);
      expect(top).toBeLessThan(200);
    });
  }

  test("the later tickets find their named slots", async ({ page }) => {
    await page.goto("/");
    for (const slot of ["live-strip", "find-me", "stack-scene"]) {
      await expect(page.locator(`[data-slot="${slot}"]`)).toHaveCount(1);
    }
  });
});

test.describe("home under reduced motion", () => {
  test.use({ colorScheme: "light", reducedMotion: "reduce" });

  for (const route of HOME_ROUTES) {
    test(`every block is visible with no transform on ${route}`, async ({ page }) => {
      await page.goto(route);
      await settlePage(page);
      const hidden = await page.evaluate(() => {
        const offenders: string[] = [];
        const blocks = globalThis.document.querySelectorAll(".scroll-reveal, .hero-enter");
        for (const element of blocks) {
          const style = globalThis.getComputedStyle(element);
          const isMoved =
            style.transform !== "none" || (style.translate !== "none" && style.translate !== "0px");
          if (isMoved || style.opacity !== "1") {
            offenders.push(`${element.tagName.toLowerCase()}.${element.className}`);
          }
        }
        return { offenders, count: blocks.length };
      });
      expect(hidden.count).toBeGreaterThan(0);
      expect(hidden.offenders).toEqual([]);
    });
  }
});
