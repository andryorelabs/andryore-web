import { expect, test } from "@playwright/test";

import { assertNoHorizontalOverflow, findClippedText, preparePage, settlePage } from "./helpers";
import { OVERFLOW_ROUTES, PHONE_WIDTHS } from "./routes";

const MOTION_PREFERENCES = ["reduce", "no-preference"] as const;

for (const motion of MOTION_PREFERENCES) {
  for (const width of PHONE_WIDTHS) {
    for (const route of OVERFLOW_ROUTES) {
      test(`no overflow on ${route} at ${String(width)}px with ${motion} motion`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await preparePage(page, "light", motion);
        await page.goto(route);
        await settlePage(page);
        await assertNoHorizontalOverflow(page);
      });
    }
  }
}

for (const route of ["/does-not-exist/", "/es/404/"]) {
  test(`the 404 title and buttons stay inside the stage at 320px on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await preparePage(page, "light");
    await page.goto(route);
    await settlePage(page);
    const outside = await page.evaluate(() => {
      const stage = globalThis.document.querySelector(".nf-stage")?.getBoundingClientRect();
      const parts = globalThis.document.querySelectorAll(".nf-title, .nf-message, .nf-button");
      return [...parts]
        .filter((part) => {
          const bounds = part.getBoundingClientRect();
          return stage === undefined || bounds.left < stage.left || bounds.right > stage.right;
        })
        .map((part) => part.className);
    });
    expect(outside).toEqual([]);
    expect(await findClippedText(page)).toEqual([]);
  });
}
