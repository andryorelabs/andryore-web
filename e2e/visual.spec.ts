import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";
import { ROUTES, THEMES, VIEWPORTS } from "./routes";

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    for (const route of ROUTES) {
      test(`${route} at ${name} (${theme})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await preparePage(page, theme);
        await page.goto(route);
        await settlePage(page);
        await expect(page).toHaveScreenshot(`${route.replaceAll("/", "_")}-${name}-${theme}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.002,
        });
      });
    }
  }
}

const SCENE_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;

for (const [name, viewport] of Object.entries(SCENE_VIEWPORTS)) {
  for (const theme of THEMES) {
    for (const route of ["/404/", "/es/404/"]) {
      test(`${route} not found at ${name} (${theme})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await preparePage(page, theme);
        await page.goto(route);
        await settlePage(page);
        await expect(page).toHaveScreenshot(
          `${route.replaceAll("/", "_")}-not-found-${name}-${theme}.png`,
          { fullPage: true, maxDiffPixelRatio: 0.002 },
        );
      });
    }

    test(`stack scene at ${name} (${theme})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await preparePage(page, theme);
      await page.goto("/");
      await settlePage(page);
      await expect(page.locator(".stack-scene")).toHaveScreenshot(
        `stack-scene-${name}-${theme}.png`,
        { maxDiffPixelRatio: 0.002 },
      );
    });
  }
}
