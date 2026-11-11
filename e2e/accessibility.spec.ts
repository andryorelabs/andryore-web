import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";
import { ROUTES, THEMES } from "./routes";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

for (const theme of THEMES) {
  for (const route of ROUTES) {
    test(`axe finds no violations on ${route} (${theme})`, async ({ page }) => {
      await preparePage(page, theme);
      await page.goto(route);
      await settlePage(page);
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations).toEqual([]);
    });
  }
}
