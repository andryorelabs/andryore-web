import { expect, test } from "@playwright/test";

import { settlePage } from "./helpers";
import { ROUTES } from "./routes";

test.use({ colorScheme: "light", reducedMotion: "reduce" });

for (const route of ROUTES) {
  test(`${route} has no animation or transition under reduced motion`, async ({ page }) => {
    await page.route("**/api/stream-status", (handler) =>
      handler.fulfill({ json: { state: "offline" } }),
    );
    await page.goto(route);
    await settlePage(page);
    const moving = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const element of globalThis.document.querySelectorAll("*")) {
        const style = globalThis.getComputedStyle(element);
        const isAnimates = style.animationName !== "none";
        const transitions = style.transitionDuration
          .split(",")
          .some((duration) => duration.trim() !== "0s");
        if (isAnimates || transitions) {
          offenders.push(`${element.tagName.toLowerCase()}.${element.className}`);
        }
      }
      return offenders;
    });
    expect(moving).toEqual([]);
  });
}
