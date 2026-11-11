import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";
import { THEMES } from "./routes";

const ABOUT_VIEWPORTS = {
  390: { width: 390, height: 844 },
  768: { width: 768, height: 1024 },
  1440: { width: 1440, height: 900 },
} as const;

const ABOUT_ROUTES = { en: "/about/", es: "/es/about/" } as const;

for (const [width, viewport] of Object.entries(ABOUT_VIEWPORTS)) {
  for (const theme of THEMES) {
    for (const [language, route] of Object.entries(ABOUT_ROUTES)) {
      test(`about ${language} at ${width} (${theme})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await preparePage(page, theme);
        await page.goto(route);
        await settlePage(page);
        await expect(page).toHaveScreenshot(`about-${language}-${width}-${theme}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.002,
        });
      });
    }
  }
}
