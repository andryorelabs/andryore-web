import { expect, test } from "@playwright/test";

import { assertNoHorizontalOverflow, preparePage, settlePage } from "./helpers";
import { ROUTES } from "./routes";

const LANDSCAPE = { width: 844, height: 390 };

for (const route of ROUTES) {
  test.describe(`landscape phone on ${route}`, () => {
    test.use({ viewport: LANDSCAPE });

    test.beforeEach(async ({ page }) => {
      await preparePage(page, "light");
      await page.goto(route);
      await settlePage(page);
    });

    test("has no horizontal overflow", async ({ page }) => {
      await assertNoHorizontalOverflow(page);
    });

    test("shows the first heading", async ({ page }) => {
      await expect(page.getByRole("heading").first()).toBeInViewport();
    });

    test("keeps the Dock off every interactive element", async ({ page }) => {
      const covered = await page.evaluate(async () => {
        const dock = globalThis.document.querySelector("[data-dock-nav]");
        if (!dock) return ["no Dock"];
        const dockBox = dock.getBoundingClientRect();
        const targets = globalThis.document.querySelectorAll<HTMLElement>(
          'main a[href], main button, main [role="slider"], main input',
        );
        const covering = new Set<string>();
        const bottom = globalThis.document.documentElement.scrollHeight;
        for (const top of [bottom]) {
          globalThis.scrollTo(0, top);
          await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
          for (const target of targets) {
            const box = target.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;
            const isOverlaps =
              box.left < dockBox.right &&
              box.right > dockBox.left &&
              box.top < dockBox.bottom &&
              box.bottom > dockBox.top;
            if (!isOverlaps) continue;
            const hit = globalThis.document.elementFromPoint(
              Math.min(Math.max(box.left + box.width / 2, 0), dockBox.right - 1),
              Math.min(Math.max(box.top + box.height / 2, 0), dockBox.bottom - 1),
            );
            if (hit && dock.contains(hit)) {
              covering.add(
                (target.getAttribute("aria-label") ?? target.textContent).trim().slice(0, 30),
              );
            }
          }
        }
        return [...covering];
      });
      expect(covered).toEqual([]);
    });
  });
}
